import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { ThemeService } from '../../../core/services/theme.service';

/** Free, key-less vector tiles. Liberty is the one style that ships a
 *  `building-3d` fill-extrusion layer, which is what makes the view 3D. */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** The bit of GeoJSON shape this component needs — kept local rather than
 *  pulling in @types/geojson, which isn't wired into this project's tsconfig. */
type AccuracyPolygon = { type: 'Polygon'; coordinates: [number, number][][] };
type AccuracyFeature = { type: 'Feature'; properties: Record<string, never>; geometry: AccuracyPolygon };

/**
 * A 3D location map. MapLibre GL is loaded on demand — it is a large library
 * and most sessions never open a map, so it must not sit in the page bundle.
 */
@Component({
  selector: 'app-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="map__canvas" #host></div>

    @if (loading()) {
      <div class="map__state">Loading map…</div>
    } @else if (failed()) {
      <div class="map__state map__state--error">
        Map unavailable offline. The coordinates below still work.
      </div>
    }

    @if (!loading() && !failed()) {
      <button type="button" class="map__tilt" (click)="toggleTilt()">
        {{ tilted() ? '2D' : '3D' }}
      </button>
    }
  `,
  styleUrl: './map.component.scss',
  host: { class: 'map' },
})
export class MapComponent implements OnDestroy {
  lat = input.required<number>();
  lng = input.required<number>();
  /** Metres — drawn as a translucent ring around the point. */
  accuracy = input<number | null>(null);
  label = input('');

  private readonly hostEl = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly theme = inject(ThemeService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly tilted = signal(true);

  private map: MapLibreMap | null = null;
  private marker: Marker | null = null;
  // `this.map` stays null for the whole `await import('maplibre-gl')` gap in
  // build() — without this flag, a lat/lng change landing during that gap
  // (plausible right after page load, when a cached fix is quickly replaced
  // by a fresh one) re-runs this effect, sees `map` still null, and starts a
  // SECOND build() on the same host element.
  private building = false;

  constructor() {
    // Build once the host exists, then keep it pointed at the latest fix.
    effect(() => {
      const el = this.hostEl().nativeElement;
      const lat = this.lat();
      const lng = this.lng();
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (this.map) {
        this.moveTo(lng, lat);
      } else if (!this.building) {
        this.building = true;
        void this.build(el, lng, lat);
      }
    });

    // Follow the app's light / dark themes.
    effect(() => {
      const dark = this.theme.activeTheme() === 'dark';
      this.hostEl().nativeElement.classList.toggle('map__canvas--dark', dark);
    });
  }

  ngOnDestroy(): void {
    this.marker?.remove();
    this.map?.remove();
    this.map = null;
  }

  toggleTilt(): void {
    if (!this.map) return;
    const next = !this.tilted();
    this.tilted.set(next);
    this.map.easeTo({ pitch: next ? 55 : 0, bearing: next ? -20 : 0, duration: 600 });
  }

  private async build(el: HTMLElement, lng: number, lat: number): Promise<void> {
    try {
      const maplibre = await import('maplibre-gl');

      // MapLibre derives its worker's URL from `import.meta.url`, which the
      // dev-server / bundler rewrite in a way that no longer resolves to a
      // real file — so it's pointed at the copy served at the site root
      // (angular.json copies it there from maplibre-gl/dist) explicitly.
      maplibre.setWorkerUrl('/maplibre-gl-worker.mjs');

      const map = new maplibre.Map({
        container: el,
        style: STYLE_URL,
        center: [lng, lat],
        zoom: 16.5,
        pitch: 55,
        bearing: -20,
        attributionControl: { compact: true },
      });

      this.map = map;
      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), 'top-right');

      map.on('error', (e: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('[app-map] maplibre error', e);
        this.loading.set(false);
        this.failed.set(true);
      });

      map.on('load', () => {
        this.loading.set(false);
        // Re-read the signals rather than closing over the lng/lat this
        // build() call started with — a fix that landed while the map was
        // still loading would otherwise leave the marker (and map center)
        // frozen at the stale position it started with.
        const curLng = this.lng();
        const curLat = this.lat();
        if (curLng !== lng || curLat !== lat) map.jumpTo({ center: [curLng, curLat] });
        this.drawAccuracy(map, curLng, curLat);
        this.marker = new maplibre.Marker({ element: this.pin(), anchor: 'bottom' })
          .setLngLat([curLng, curLat])
          .addTo(map);
      });
    } catch {
      this.loading.set(false);
      this.failed.set(true);
      this.building = false;
    }
  }

  /**
   * A later fix (a "Refresh" click, or the ~2-min background ping landing a
   * new coordinate) moved the marker here but never touched the accuracy
   * circle's source data — so it stayed drawn around the very first fix
   * while the pin moved on, leaving the two visibly apart on the map.
   */
  private moveTo(lng: number, lat: number): void {
    this.map?.easeTo({ center: [lng, lat], duration: 700 });
    this.marker?.setLngLat([lng, lat]);
    if (this.map?.isStyleLoaded()) this.drawAccuracy(this.map, lng, lat);
  }

  /** GPS accuracy as a circle on the ground, in metres — (re)computed at
   *  the current fix each time, and updated in place if already drawn. */
  private drawAccuracy(map: MapLibreMap, lng: number, lat: number): void {
    const metres = this.accuracy();
    const geometry: AccuracyPolygon | null =
      metres && metres > 0 ? { type: 'Polygon', coordinates: [this.accuracyRing(lng, lat, metres)] } : null;

    const source = map.getSource('accuracy') as { setData: (data: AccuracyFeature) => void } | undefined;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: geometry ?? { type: 'Polygon', coordinates: [[]] },
      });
      return;
    }
    if (!geometry) return;

    map.addSource('accuracy', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry },
    });
    map.addLayer({
      id: 'accuracy-fill',
      type: 'fill',
      source: 'accuracy',
      paint: { 'fill-color': '#2d6be0', 'fill-opacity': 0.15 },
    });
    map.addLayer({
      id: 'accuracy-line',
      type: 'line',
      source: 'accuracy',
      paint: { 'line-color': '#2d6be0', 'line-width': 1.5, 'line-opacity': 0.7 },
    });
  }

  /** A circle of lng/lat points, `metres` out from the centre. */
  private accuracyRing(lng: number, lat: number, metres: number): [number, number][] {
    const points: [number, number][] = [];
    const latRad = (lat * Math.PI) / 180;
    const dLat = metres / 111_320;
    const dLng = metres / (111_320 * Math.max(Math.cos(latRad), 1e-6));
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * 2 * Math.PI;
      points.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
    }
    return points;
  }

  /** The pin is plain DOM, so it keeps the app's look and stays un-tinted. */
  private pin(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'map__pin';
    el.innerHTML = `
      <span class="map__pin-pulse"></span>
      <svg viewBox="0 0 24 32" width="30" height="40" aria-hidden="true">
        <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.6 12 32 12 32s12-11.4 12-20.1C24 5.3 18.6 0 12 0z" fill="currentColor"/>
        <circle cx="12" cy="11.5" r="4.6" fill="#fff"/>
      </svg>`;
    if (this.label()) el.title = this.label();
    return el;
  }
}
