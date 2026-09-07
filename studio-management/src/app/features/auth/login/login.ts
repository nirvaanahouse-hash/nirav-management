import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";
import { ButtonComponent } from "../../../shared/components/button/button";
import { AuthCredentials } from "../../../core/models/user.model";
import { ToastService } from "../../toast/toast.service";
import { toastIfInvalid } from "../../../core/utils/form-toast";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonComponent],
  templateUrl: "./login.html",
  styleUrl: "./login.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  readonly submitting = signal(false);
  private readonly toast = inject(ToastService);

  readonly form = this.fb.nonNullable.group({
    email: ["", [Validators.required, Validators.minLength(3)]],
    password: ["", [Validators.required, Validators.minLength(6)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  submit(): void {
    if (toastIfInvalid(this.form, this.toast, { email: "Email or username", password: "Password" })) {
      return;
    }

    this.submitting.set(true);

    const payload = this.form.value as AuthCredentials;

    this.authService.login(payload).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.toast.success("Signed in", "Welcome back.");

        const redirectTo = this.route.snapshot.queryParamMap.get("redirectTo");
        const fallback =
          response.user.role === "SA"
            ? "/sa/dashboard"
            : "/employee/dashboard";

        this.router.navigateByUrl(redirectTo || fallback);
      },
      error: () => {
        this.submitting.set(false);
      },
    });
  }
}