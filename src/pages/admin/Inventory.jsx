import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Package, Plus, Minus, ArrowUpRight, ArrowDownRight, RefreshCcw } from 'lucide-react';

const API_URL = '/api';

function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ itemName: '', category: '', currentQuantity: '', lowStockThreshold: '', unit: 'bags' });
  const [transaction, setTransaction] = useState({ itemId: '', type: 'In', quantity: '', remarks: '' });

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Unable to load inventory');
      }

      const data = await response.json();
      setItems(data.items || []);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to load inventory.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          itemName: form.itemName,
          category: form.category,
          currentQuantity: Number(form.currentQuantity),
          lowStockThreshold: Number(form.lowStockThreshold || 0),
          unit: form.unit
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to add inventory item');

      setForm({ itemName: '', category: '', currentQuantity: '', lowStockThreshold: '', unit: 'bags' });
      fetchInventory();
    } catch (err) {
      setError(err.message || 'Unable to add inventory item');
    }
  };

  const handleTransaction = async (e) => {
    e.preventDefault();
    if (!transaction.itemId) {
      setError('Select an inventory item first.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/inventory/${transaction.itemId}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          transactionType: transaction.type,
          quantity: Number(transaction.quantity),
          remarks: transaction.remarks
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to record inventory transaction');

      setTransaction({ itemId: '', type: 'In', quantity: '', remarks: '' });
      fetchInventory();
    } catch (err) {
      setError(err.message || 'Unable to record inventory transaction');
    }
  };

  return (
    <AdminLayout title="Inventory" description="Manage agricultural inputs and stock movements">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="text-agapay-purple" size={18} />
                <h2 className="text-lg font-semibold text-gray-900">Add Inventory Item</h2>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleAddItem}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item name</label>
                <input
                  value={form.itemName}
                  onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
                  placeholder="Hybrid Rice Seeds"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
                    placeholder="Seeds"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
                  >
                    <option value="bags">bags</option>
                    <option value="sacks">sacks</option>
                    <option value="pcs">pcs</option>
                    <option value="sets">sets</option>
                    <option value="liters">liters</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={form.currentQuantity}
                    onChange={(e) => setForm({ ...form, currentQuantity: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low stock threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={form.lowStockThreshold}
                    onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
                  />
                </div>
              </div>

              <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-agapay-purple px-4 py-2.5 text-sm font-semibold text-white hover:bg-agapay-purpleDark">
                <Plus size={16} />
                Add Item
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="text-green-600" size={18} />
                <h2 className="text-lg font-semibold text-gray-900">Record Stock Movement</h2>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleTransaction}>
              <select
                value={transaction.itemId}
                onChange={(e) => setTransaction({ ...transaction, itemId: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
              >
                <option value="">Select item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.itemName}</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={transaction.type}
                  onChange={(e) => setTransaction({ ...transaction, type: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
                >
                  <option value="In">Stock In</option>
                  <option value="Out">Stock Out</option>
                  <option value="Adjustment">Adjustment</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={transaction.quantity}
                  onChange={(e) => setTransaction({ ...transaction, quantity: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
                  placeholder="Qty"
                  required
                />
              </div>

              <input
                value={transaction.remarks}
                onChange={(e) => setTransaction({ ...transaction, remarks: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
                placeholder="Remarks (optional)"
              />

              <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                {transaction.type === 'Out' ? <Minus size={16} /> : <Plus size={16} />}
                Save Movement
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Current Inventory</h2>
            </div>
            <button type="button" onClick={fetchInventory} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Threshold</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-10 text-center text-sm text-gray-500">
                      Loading inventory...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-10 text-center text-sm text-gray-500">
                      No inventory items found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isLowStock = Number(item.currentQuantity) <= Number(item.lowStockThreshold || 0);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{item.itemName}</div>
                          <div className="text-xs text-gray-500">{item.category || 'General'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.currentQuantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.lowStockThreshold}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.unit}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {isLowStock ? 'Low Stock' : 'Healthy'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Inventory;