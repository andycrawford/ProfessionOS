import RecordTypeClient from "./RecordTypeClient";

type Params = { recordType: string };

export default async function RecordTypePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { recordType } = await params;
  return <RecordTypeClient recordType={recordType} />;
}
