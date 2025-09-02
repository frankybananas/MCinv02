"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Car, User, FileText, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { Delivery, DeliveryDoc, DeliveryDocKind, Client, Car as CarType, ReconTask } from "../types";
import { saveDoc as idbSaveDoc, getDoc as idbGetDoc, makeLocalKey } from "@/lib/idb-docs";

interface DeliveryDetailProps {
  delivery: Delivery;
  onBack: () => void;
  onSave: (update: Partial<Delivery> & { docs?: DeliveryDoc[] }) => Promise<void> | void;
}

export function DeliveryDetail({ delivery, onBack, onSave }: DeliveryDetailProps) {
  const LOCAL_ONLY = process.env.NEXT_PUBLIC_LOCAL_DOCS_ONLY === 'true';
  const [deliveryDate, setDeliveryDate] = useState<string>(delivery.deliveryDate?.slice(0,10) || "");
  const [financeBank, setFinanceBank] = useState<string>(delivery.financeBank || "");
  const [reconTasks, setReconTasks] = useState<ReconTask[]>(() => {
    const tasks = (delivery as any).reconTasks as ReconTask[] | undefined;
    if (tasks && tasks.length) return tasks;
    const legacyNotes = (delivery as any).reconNotes as string | undefined;
    if (legacyNotes && legacyNotes.trim().length) {
      return [{ text: legacyNotes, done: false, note: "" }];
    }
    return [];
  });
  const [newTaskText, setNewTaskText] = useState("");
  const [notesOpen, setNotesOpen] = useState<Record<number, boolean>>({});
  const [licensingDone, setLicensingDone] = useState<boolean>(!!delivery.licensing?.done);
  const [licensingNotes, setLicensingNotes] = useState<string>(delivery.licensing?.notes || "");
  const [customerType, setCustomerType] = useState<"natural" | "company">(delivery.customerType || "natural");
  const [docs, setDocs] = useState<DeliveryDoc[]>(delivery.docs || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(
    typeof delivery.client === 'object' ? delivery.client._id : delivery.client || ""
  );

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch('/api/clients');
        if (res.ok) {
          const data = await res.json();
          setClients(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch clients:', error);
      }
    };
    fetchClients();
  }, []);

  const requiredNatural: DeliveryDocKind[] = ["id_copy", "proof_of_address"];
  const requiredCompany: DeliveryDocKind[] = ["company_docs", "director_id", "company_proof_of_address", "brnc_certificate"];

  const handleUpload = async (file: File, kind: DeliveryDocKind) => {
    setUploading(true);
    try {
      if (LOCAL_ONLY) {
        const localKey = makeLocalKey(typeof delivery._id === 'string' ? delivery._id : String((delivery as any)._id), kind);
        await idbSaveDoc(localKey, file);
        const doc: DeliveryDoc = {
          kind,
          localKey,
          fileType: file.type,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        };
        setDocs((prev) => [...prev, doc]);
      } else {
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
      }
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
        reconTasks,
        licensing: { done: licensingDone, notes: licensingNotes },
        customerType,
        client: selectedClientId || undefined,
        // Only send newly added docs; compare by url or localKey
        docs: docs.filter((d) => !delivery.docs?.some((ex) => (ex.url && d.url && ex.url === d.url) || (ex.localKey && d.localKey && ex.localKey === d.localKey))),
      });
    } finally {
      setSaving(false);
    }
  };

  const currentRequired = customerType === "natural" ? requiredNatural : requiredCompany;

  const car = delivery.car as CarType;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="sticky top-[56px] z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 p-3 sm:p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base sm:text-lg font-semibold truncate">
            Delivery Preparation
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving || uploading} className="ml-2">
          {saving ? "Saving..." : "Save"}
        </Button>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-4 space-y-6">
          {/* Car Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="w-5 h-5" />
                Car Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Make & Model</p>
                  <p className="font-semibold">{car?.make} {car?.model}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Year</p>
                  <p className="font-semibold">{car?.year}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Price</p>
                  <p className="font-semibold">R{car?.price?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Status</p>
                  <p className="font-semibold capitalize">{car?.status?.replace('-', ' ')}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">VIN</p>
                  <p className="font-semibold">{car?.vin}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Color</p>
                  <p className="font-semibold">{car?.color}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Kilometers</p>
                  <p className="font-semibold">{car?.kilometers?.toLocaleString()} km</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Transmission</p>
                  <p className="font-semibold capitalize">{car?.transmission}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Linking Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="client">Link Client</Label>
                  <Select value={selectedClientId} onValueChange={(v) => setSelectedClientId(v === 'none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client for this delivery" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No client selected</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client._id} value={client._id}>
                          {client.firstName} {client.lastName} - {client.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {typeof delivery.client === 'object' && delivery.client && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium">Current Client:</p>
                    <p>{delivery.client.firstName} {delivery.client.lastName}</p>
                    <p className="text-sm text-muted-foreground">{delivery.client.phone}</p>
                    {delivery.client.email && (
                      <p className="text-sm text-muted-foreground">{delivery.client.email}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
                <Label>Recon Tasks</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a task (e.g., interior valet, paint touch-up)"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTaskText.trim()) {
                        setReconTasks((prev) => [...prev, { text: newTaskText.trim(), done: false }]);
                        setNewTaskText("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (!newTaskText.trim()) return;
                      setReconTasks((prev) => [...prev, { text: newTaskText.trim(), done: false }]);
                      setNewTaskText("");
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {reconTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">No recon tasks yet. Add tasks above.</p>
                  )}
                  <ul className="space-y-2">
                    {reconTasks.map((t, idx) => (
                      <li key={idx} className="border rounded-md p-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={!!t.done}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setReconTasks((prev) => prev.map((it, i) => i === idx ? { ...it, done: checked } : it));
                            }}
                          />
                          <Input
                            value={t.text}
                            onChange={(e) => setReconTasks((prev) => prev.map((it, i) => i === idx ? { ...it, text: e.target.value } : it))}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setNotesOpen((p) => ({ ...p, [idx]: !p[idx] }))}
                            title="Task notes"
                          >
                            <FileText className={`w-4 h-4 ${t.note && t.note.trim().length ? 'text-blue-600' : 'text-muted-foreground'}`} />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setReconTasks((prev) => prev.filter((_, i) => i !== idx))}
                            title="Remove task"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                        {notesOpen[idx] && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2 mb-1 text-sm text-muted-foreground">
                              <FileText className="w-4 h-4" />
                              <span>Notes</span>
                            </div>
                            <Textarea
                              placeholder="Optional notes for this task"
                              value={t.note || ""}
                              onChange={(e) => setReconTasks((prev) => prev.map((it, i) => i === idx ? { ...it, note: e.target.value } : it))}
                              rows={3}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
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
                    {docs.map((d, idx) => (
                      <li key={(d.url || d.localKey || String(idx))} className="break-all flex items-center gap-2">
                        <span className="uppercase text-xs bg-gray-100 px-1 py-0.5 rounded mr-2">{d.kind}</span>
                        {d.url ? (
                          <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{d.url}</a>
                        ) : d.localKey ? (
                          <button
                            type="button"
                            className="text-blue-600 hover:underline"
                            onClick={async () => {
                              const blob = await idbGetDoc(d.localKey!);
                              if (!blob) return alert('File not found on this device');
                              const url = URL.createObjectURL(blob);
                              window.open(url, '_blank');
                              setTimeout(() => URL.revokeObjectURL(url), 60_000);
                            }}
                          >
                            View local file
                          </button>
                        ) : (
                          <span className="text-muted-foreground">No reference</span>
                        )}
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
