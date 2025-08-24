"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Delivery, DeliveryDoc, DeliveryDocKind } from "../types";

interface DeliveryDetailProps {
  delivery: Delivery;
  onBack: () => void;
  onSave: (update: Partial<Delivery> & { docs?: DeliveryDoc[] }) => Promise<void> | void;
}

export function DeliveryDetail({ delivery, onBack, onSave }: DeliveryDetailProps) {
  const [deliveryDate, setDeliveryDate] = useState<string>(delivery.deliveryDate?.slice(0,10) || "");
  const [financeBank, setFinanceBank] = useState<string>(delivery.financeBank || "");
  const [reconNotes, setReconNotes] = useState<string>(delivery.reconNotes || "");
  const [licensingDone, setLicensingDone] = useState<boolean>(!!delivery.licensing?.done);
  const [licensingNotes, setLicensingNotes] = useState<string>(delivery.licensing?.notes || "");
  const [customerType, setCustomerType] = useState<"natural" | "company">(delivery.customerType || "natural");
  const [docs, setDocs] = useState<DeliveryDoc[]>(delivery.docs || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const requiredNatural: DeliveryDocKind[] = ["id_copy", "proof_of_address"];
  const requiredCompany: DeliveryDocKind[] = ["company_docs", "director_id", "company_proof_of_address", "brnc_certificate"];

  const handleUpload = async (file: File, kind: DeliveryDocKind) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const { data } = await res.json();
      const doc: DeliveryDoc = {
        kind,
        url: data.url,
        fileType: data.fileType,
        fileSize: data.fileSize,
        uploadedAt: new Date().toISOString(),
      };
      setDocs((prev) => [...prev, doc]);
    } catch (e) {
      console.error(e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, kind: DeliveryDocKind) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, kind);
    e.currentTarget.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        financeBank,
        reconNotes,
        licensing: { done: licensingDone, notes: licensingNotes },
        customerType,
        docs: docs.filter((d) => !delivery.docs?.some((ex) => ex.url === d.url)),
      });
    } finally {
      setSaving(false);
    }
  };

  const currentRequired = customerType === "natural" ? requiredNatural : requiredCompany;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b p-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h2 className="text-lg font-semibold">Delivery Preparation</h2>
          <div className="space-x-2">
            <Button variant="outline" onClick={onBack}>Back</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          <Card>
            <CardContent className="p-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deliveryDate">Delivery date</Label>
                <Input id="deliveryDate" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="financeBank">Finance bank</Label>
                <Input id="financeBank" value={financeBank} onChange={(e) => setFinanceBank(e.target.value)} placeholder="ABSA, FNB, ..." />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="reconNotes">Recon notes</Label>
                <Textarea id="reconNotes" value={reconNotes} onChange={(e) => setReconNotes(e.target.value)} rows={4} />
              </div>
              <div className="space-y-2">
                <Label>Licensing done</Label>
                <Select value={licensingDone ? "yes" : "no"} onValueChange={(v) => setLicensingDone(v === "yes") }>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="licNotes">Licensing notes</Label>
                <Input id="licNotes" value={licensingNotes} onChange={(e) => setLicensingNotes(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Customer type</Label>
                <Select value={customerType} onValueChange={(v: any) => setCustomerType(v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natural">Natural person</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold">Required documents</h3>
              {currentRequired.map((kind) => (
                <div key={kind} className="grid sm:grid-cols-2 gap-2 items-center">
                  <Label className="capitalize">{kind.replaceAll('_',' ')}</Label>
                  <div className="flex items-center gap-2">
                    <Input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => onFileChange(e, kind)} />
                  </div>
                </div>
              ))}

              {docs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Uploaded</h4>
                  <ul className="text-sm list-disc pl-5 space-y-1">
                    {docs.map((d) => (
                      <li key={d.url} className="break-all">
                        <span className="uppercase text-xs bg-gray-100 px-1 py-0.5 rounded mr-2">{d.kind}</span>
                        <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{d.url}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
