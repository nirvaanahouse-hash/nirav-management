import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ModalComponent } from '../modal.component';
import { ButtonComponent } from '../../../shared/components/button/button';
import { ConfirmDialogService } from './confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog-host',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl:'./confirm-dialog-host.component.html',
  styleUrls: ['./confirm-dialog-host.component.scss'],
})
export class ConfirmDialogHostComponent {
  service = inject(ConfirmDialogService);
}

