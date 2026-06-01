"use client";

export default function BillableTab({ onIssued }: { onIssued?: () => void }) {
  void onIssued;
  return <div className="text-muted-foreground p-4">לחיוב — בקרוב</div>;
}
