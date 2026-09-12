import {
  Component,
  computed,
  signal,
  ChangeDetectionStrategy,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormFieldComponent } from "../../shared/components/form-field/form-field.component";
import { ButtonComponent } from "../../shared/components/button/button";
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  FormGroup,
  FormArray,
} from "@angular/forms";
import { AuthService } from "../../core/services/auth.service";
import { ProfileService, ProfileData } from "../../core/services/profile.service";
import { LocationService } from "../../core/services/location.service";
import { PushNotificationService } from "../../core/services/push-notification.service";
import { ToastService } from "../../features/toast/toast.service";

interface Profile {
  image: string;
  fullName: string;
  username: string;
  email: string;
  mobileNo: string;
  address: string;
  role: string;
  gender: "male" | "female" | "other";
  dob: string;
  percentage: number;
  password: string;
  confirmPassword: string;
}

@Component({
  selector: "app-profile",
  imports: [CommonModule, ReactiveFormsModule, FormFieldComponent, ButtonComponent],
  templateUrl: "./profile.html",
  styleUrl: "./profile.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  /** Largest profile photo we accept (5 MB). */
  private static readonly MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  private fb = new FormBuilder();
  private profileService = inject(ProfileService);
  private toastService = inject(ToastService);
  readonly locationService = inject(LocationService);
  readonly pushNotifications = inject(PushNotificationService);

  toggleLocationSharing(on: boolean): void {
    this.locationService.setSharing(on);
    this.toastService.success(on ? "Location sharing on." : "Location sharing off.");
  }

  async togglePushNotifications(on: boolean): Promise<void> {
    if (on) {
      const ok = await this.pushNotifications.enable();
      if (ok) {
        this.toastService.success("Push notifications on.");
      } else if (this.pushNotifications.permission() === "denied") {
        this.toastService.error(
          "Notifications blocked",
          "Allow notifications for this site in your browser settings, then try again.",
        );
      } else {
        this.toastService.error("Could not enable notifications", "Please try again.");
      }
    } else {
      await this.pushNotifications.disable();
      this.toastService.success("Push notifications off.");
    }
  }

  readonly profile = signal<Profile>({
    image: "",
    fullName: "",
    username: "",
    email: "",
    mobileNo: "",
    address: "",
    role: "U",
    gender: "male",
    dob: "",
    percentage: 0,
    password: "",
    confirmPassword: "",
  });

  readonly isSaving = signal(false);
  readonly isUploadingPhoto = signal(false);
  readonly passwordVisible = signal(false);
  readonly confirmPasswordVisible = signal(false);

  readonly isSA = computed(() => this.authService.isSuperAdmin());

  readonly roleLabel = computed(() => {
    const role = this.authService.role();
    const labels = { SA: "Super Admin", A: "Admin", U: "Employee" };
    return role ? labels[role as keyof typeof labels] || role : "Employee";
  });

  readonly initial = computed(
    () => (this.profile().fullName || this.profile().username || "?").charAt(0).toUpperCase(),
  );

  readonly memberSince = computed(() => {
    const created = this.authService.currentUser()?.createdAt;
    if (!created) return "";
    return new Date(created).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  });

  /** Rough profile-completeness for the progress ring. */
  readonly completion = computed(() => {
    const p = this.profile();
    const fields = [p.fullName, p.username, p.email, p.mobileNo, p.address, p.dob, p.image];
    const filled = fields.filter((v) => !!String(v ?? "").trim()).length;
    return Math.round((filled / fields.length) * 100);
  });

  constructor(private readonly authService: AuthService) {
    this.loadProfile();
  }

  loadProfile(): void {
    this.profileService.getProfile().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.profile.set({
            image: this.profileService.resolveImageUrl(response.data.image),
            fullName: `${response.data.firstName || ''} ${response.data.lastName || ''}`.trim(),
            username: response.data.userName || "",
            email: response.data.email || "",
            mobileNo: response.data.mobileNumber || "",
            address: response.data.homeAddress || "",
            role: response.data.role || "U",
            gender: (response.data.gender || "male") as Profile["gender"],
            dob: response.data.dob || "",
            percentage: response.data.percentage || 0,
            password: "",
            confirmPassword: "",
          });

          this.form.patchValue({
            fullName: this.profile().fullName,
            username: this.profile().username,
            email: this.profile().email,
            mobileNo: this.profile().mobileNo,
            address: this.profile().address,
            gender: this.profile().gender,
            dob: this.profile().dob,
            percentage: this.profile().percentage,
            password: "",
            confirmPassword: "",
          });
        }
      },
      error: () => {
        this.toastService.error("Could not load profile", "Please try again.");
      },
    });
  }

  private matchPasswordValidator(control: AbstractControl) {
    const password = control.parent?.get("password")?.value;
    const confirmPassword = control.value;

    if (password && !confirmPassword) return { required: true };

    if (!password && !confirmPassword) return null;

    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  private touchAndValidate(control: AbstractControl): void {
    if (control instanceof FormGroup || control instanceof FormArray) {
      Object.values(control.controls).forEach((c) => this.touchAndValidate(c));
    } else {
      control.markAsTouched();
      control.markAsDirty();
    }

    control.updateValueAndValidity({ emitEvent: true });
  }

  form = this.fb.nonNullable.group(
    {
      fullName: [
        this.profile().fullName,
        [Validators.required, Validators.minLength(2)],
      ],
      username: [
        this.profile().username,
        [Validators.required, Validators.minLength(3)],
      ],
      email: [this.profile().email, [Validators.required, Validators.email]],
      mobileNo: [
        this.profile().mobileNo,
        [Validators.required, Validators.pattern(/^[0-9+\- ]{7,15}$/)],
      ],
      address: [
        this.profile().address,
        [Validators.required, Validators.minLength(5)],
      ],
      gender: [this.profile().gender, [Validators.required]],
      dob: [this.profile().dob, [Validators.required]],
      // Read-only for the user — set by SA on the Users page.
      percentage: [this.profile().percentage, [Validators.min(0), Validators.max(100)]],
      password: [this.profile().password, [Validators.minLength(6)]],
      confirmPassword: [this.profile().confirmPassword, [this.matchPasswordValidator.bind(this)]],
    },
  );

  togglePasswordVisibility(): void {
    this.passwordVisible.update((value) => !value);
  }

  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible.update((value) => !value);
  }

  updateField<K extends keyof Profile>(key: K, value: Profile[K]): void {
    this.profile.update((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  uploadImage(event: Event): void {
    const input = event.target as HTMLInputElement;

    const file = input.files?.[0];
    // Allow re-selecting the same file after a failed/removed upload.
    input.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      this.toastService.error("Unsupported file", "Please choose an image file.");
      return;
    }

    if (file.size > ProfileComponent.MAX_IMAGE_BYTES) {
      this.toastService.error("Image too large", "Please choose an image up to 5 MB.");
      return;
    }

    if (this.isUploadingPhoto()) return;
    this.isUploadingPhoto.set(true);

    this.profileService.uploadPhoto(file).subscribe({
      next: (res) => {
        this.isUploadingPhoto.set(false);
        this.profile.update((prev) => ({
          ...prev,
          image: this.profileService.resolveImageUrl(res.data?.image),
        }));
        this.toastService.success("Photo updated.");
      },
      error: () => {
        // The HTTP interceptor already surfaces the server message as a toast.
        this.isUploadingPhoto.set(false);
      },
    });
  }

  removeImage(): void {
    if (this.isUploadingPhoto()) return;
    this.isUploadingPhoto.set(true);

    this.profileService.deletePhoto().subscribe({
      next: () => {
        this.isUploadingPhoto.set(false);
        this.profile.update((prev) => ({ ...prev, image: "" }));
        this.toastService.success("Photo removed.");
      },
      error: () => {
        this.isUploadingPhoto.set(false);
      },
    });
  }

  saveProfile(): void {
    this.touchAndValidate(this.form);

    if (!this.form.valid) {
      this.toastService.error('Please fix the highlighted errors before saving.');
      return;
    }

    if (this.isSaving()) return;

    this.isSaving.set(true);

    const raw = this.form.getRawValue();
    const nameParts = raw.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const payload: Partial<ProfileData> = {
      firstName,
      lastName,
      userName: raw.username,
      email: raw.email,
      mobileNumber: raw.mobileNo,
      homeAddress: raw.address,
      gender: raw.gender,
      dob: raw.dob,
      // `percentage` is intentionally omitted — it's managed by SA on the Users page.
      // `image` is omitted too — the photo is uploaded separately via ProfileService.
    };

    if (raw.password) {
      payload.password = raw.password;
    }

    this.profileService.updateProfile(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toastService.success('Profile updated successfully.');
        this.form.patchValue({ password: "", confirmPassword: "" });
        this.loadProfile();
      },
      error: (err: Error) => {
        this.isSaving.set(false);
        this.toastService.error('Save failed', err.message);
      },
    });
  }
}
