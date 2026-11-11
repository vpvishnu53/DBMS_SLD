'use client';
import { useParams } from 'next/navigation';
import { useMeta } from '@/lib/meta';
import { RESOURCES } from '@/lib/ui-config';
import { humanize } from '@/lib/format';
import ResourceTable from '@/components/ResourceTable';
import EnergyLogForm from '@/components/EnergyLogForm';
import { ErrorBox, PageHeader, Spinner } from '@/components/ui';
import { useState } from 'react';

export default function ResourcePage() {
  const { resource } = useParams();
  const { meta, error } = useMeta();
  const [key, setKey] = useState(0);

  if (error) return <ErrorBox error={error} />;
  if (!meta) return <Spinner center />;
  const m = meta[resource];
  if (!m) return <ErrorBox error={{ message: `Unknown section “${resource}”.` }} />;
  const cfg = RESOURCES[resource] || {};

  return (
    <>
      <PageHeader title={humanize(resource.replace(/-/g, '_'))} sub={cfg.blurb}>
        {resource === 'energy-logs' && <EnergyLogForm onSaved={() => setKey((k) => k + 1)} />}
      </PageHeader>
      <ResourceTable key={key} resource={resource} meta={m} />
    </>
  );
}
