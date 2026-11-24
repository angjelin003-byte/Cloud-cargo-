import { getWarehouseSnapshot } from '@/lib/warehouse-store';
import { WarehouseWorkspace } from '@/components/WarehouseWorkspace';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const initialSnapshot = getWarehouseSnapshot();
  return <WarehouseWorkspace initialSnapshot={initialSnapshot} />;
}
