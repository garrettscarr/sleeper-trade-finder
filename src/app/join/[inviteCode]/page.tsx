import { AutoUnlock } from "@/components/AutoUnlock";

type Props = { params: Promise<{ inviteCode: string }> };

export default async function JoinWithCodePage({ params }: Props) {
  const { inviteCode } = await params;

  return (
    <div className="panel" style={{ maxWidth: 480, margin: "1rem auto 3rem" }}>
      <h1 style={{ marginTop: 0 }}>Joining league</h1>
      <AutoUnlock code={inviteCode} />
    </div>
  );
}
