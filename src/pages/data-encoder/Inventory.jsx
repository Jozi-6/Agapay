import { useEffect, useState } from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { DataEncoderLayout } from '../../components/data-encoder/DataEncoderLayout';

const API_URL = '/api';

function DataEncoderInventory() {
  const [metrics, setMetrics] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        const [lowStockResponse, statsResponse] = await Promise.all([
          fetch(`${API_URL}/inventory/low-stock`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/encoding/statistics`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const lowStockData = await lowStockResponse.json();
        const statsData = await statsResponse.json();

        if (lowStockResponse.ok) {
          setItems(lowStockData.items || []);
        }
        if (statsResponse.ok) {
          setMetrics(statsData);
        }
      } catch (error) {
        console.error(error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <DataEncoderLayout metrics={metrics}>
      <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-indigo-100 flex items-center gap-2">
          <Package size={18} className="text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-gray-500">Loading inventory...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-sm text-gray-500">No low-stock items found.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[680px]">
              <thead className="bg-indigo-50/60">
                <tr>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Item Name</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Current Qty</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Threshold</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-indigo-50/40">
                    <td className="px-5 py-3 text-sm font-semibold text-gray-900">{item.name}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {item.threshold} {item.unit}
                    </td>
                    <td className="px-5 py-3 text-sm text-red-700 inline-flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      Low Stock
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DataEncoderLayout>
  );
}

export default DataEncoderInventory;
