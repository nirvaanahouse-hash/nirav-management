import { ChangeDetectionStrategy, Component, DestroyRef, signal, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommonModule } from "@angular/common";
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { Router } from "@angular/router";
import { ButtonComponent } from "../../../shared/components/button/button";
import { AuthService } from "../../../core/services/auth.service";
import { RegisterPayload } from "../../../core/models/user.model";
import { ToastService } from "../../toast/toast.service";
import { toastIfInvalid } from "../../../core/utils/form-toast";

@Component({
  selector: "app-register",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent],
  templateUrl: "./register.html",
  styleUrl: "./register.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  readonly submitting = signal(false);
  private readonly toast = inject(ToastService);

  private readonly passwordMatchValidator = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    const password = control.get("password")?.value;
    const confirmPassword = control.get("confirmPassword")?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  };

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      name: ["", [Validators.required, Validators.minLength(2)]],
      username: ["", [Validators.required, Validators.minLength(3)]],
      email: ["", [Validators.required, Validators.email]],
      mobileNo: ["", [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      address: [""],
      password: ["", [Validators.required, Validators.minLength(6)]],
      confirmPassword: ["", [Validators.required, Validators.minLength(6)]],
    },
    { validators: this.passwordMatchValidator },
  );

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly destroyRef: DestroyRef,
  ) {}

  submit(): void {
    if (
      toastIfInvalid(this.form, this.toast, {
        name: "Full name",
        username: "Username",
        email: "Email",
        mobileNo: "Mobile number",
        password: "Password",
        confirmPassword: "Confirm password",
      })
    ) {
      return;
    }

    this.submitting.set(true);

    const raw = this.form.getRawValue();

    const nameParts = raw.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const payload: RegisterPayload = {
      firstName,
      lastName,
      userName: raw.username,
      email: raw.email,
      password: raw.password,
      mobileNumber: raw.mobileNo,
      role: "U",
    };

    this.authService.register(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success("Account created", "You can sign in now.");
        this.router.navigate(["/auth/login"], {
          queryParams: { registered: true, email: raw.email },
        });
      },
      error: () => {
        this.submitting.set(false);
      },
    });
  }

  navigateToLogin(): void {
    this.router.navigate(["/auth/login"]);
  }
}
