import { RedeemDeviceLink } from "@/components/RedeemDeviceLink";

type Props = { params: Promise<{ token: string }> };

export default async function DeviceLinkPage({ params }: Props) {
  const { token } = await params;
  return (
    <div className="panel" style={{ maxWidth: 480, margin: "1rem auto 3rem" }}>
      <h1 style={{ marginTop: 0 }}>Signing you in</h1>
      <RedeemDeviceLink token={token} />
    </div>
  );
}
