"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { Logo } from "../../components/Logo";

type SetupRequired = { required: boolean };

type UserResponse = {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
};

type Phase = "checking" | "check-error" | "form" | "submitting" | "success";

export default function SetupPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("checking");
  const [checkError, setCheckError] = useState("");
  const [formError, setFormError] = useState("");

  const [householdName, setHouseholdName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  function runSetupCheck() {
    setPhase("checking");
    setCheckError("");
    apiGet<SetupRequired>("/api/v1/setup/required")
      .then(({ required }) => {
        if (!required) {
          router.push("/login");
        } else {
          setPhase("form");
        }
      })
      .catch((e: Error) => {
        setCheckError(e.message);
        setPhase("check-error");
      });
  }

  useEffect(() => {
    runSetupCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    setPhase("submitting");

    try {
      await apiPost<UserResponse>("/api/v1/setup/initialize", {
        household_name: householdName,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
      });
      setPhase("success");
      setTimeout(() => router.push("/login"), 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("409")) {
        setFormError("Setup has already been completed.");
        setTimeout(() => router.push("/login"), 2000);
      } else if (msg.includes("422")) {
        setFormError(
          "Please check your input — all fields are required and email must be valid."
        );
      } else {
        setFormError(msg);
      }
      setPhase("form");
    }
  }

  if (phase === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <StatusMessage kind="loading" message="Checking setup status…" />
      </div>
    );
  }

  if (phase === "check-error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <StatusMessage kind="error" message={checkError} onRetry={runSetupCheck} />
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <StatusMessage kind="loading" message="Household created. Redirecting to login…" />
      </div>
    );
  }

  const isSubmitting = phase === "submitting";

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex justify-center mb-8">
          <Logo size="md" tagline />
        </div>
        <Card title="Set up your household">
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <Input
              label="Household Name"
              type="text"
              required
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              disabled={isSubmitting}
            />

            <Input
              label="Your Name"
              type="text"
              required
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              disabled={isSubmitting}
            />

            <Input
              label="Email"
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              disabled={isSubmitting}
            />

            <Input
              label="Password"
              type="password"
              required
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              disabled={isSubmitting}
            />

            {formError && (
              <p className="text-sm text-danger">{formError}</p>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full">
              {isSubmitting ? "Creating household…" : "Create Household"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
