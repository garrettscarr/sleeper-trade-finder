import { EnterCodeForm } from "@/components/EnterCodeForm";

export default function JoinPage() {
  return (
    <div className="panel" style={{ maxWidth: 480, margin: "1rem auto 3rem" }}>
      <h1 style={{ marginTop: 0 }}>Enter code</h1>
      <p className="muted">
        Paste the invite code from your commissioner (or admin code if you run the league).
      </p>
      <EnterCodeForm />
    </div>
  );
}
