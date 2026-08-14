import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomerForm from '../components/CustomerForm.jsx';
import * as customerService from '../services/customer.service.js';

export default function CustomerEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    customerService
      .getCustomer(id)
      .then(setInitial)
      .catch((err) => setLoadError(err.response?.data?.message || 'Failed to load customer.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(payload) {
    setSubmitting(true);
    setError('');
    try {
      await customerService.updateCustomer(id, payload);
      navigate(`/customers/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update customer.');
      setSubmitting(false);
    }
  }

  if (loading) return <p className="font-mono text-sm text-navy/50">Loading…</p>;
  if (loadError)
    return <div className="rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{loadError}</div>;

  return (
    <section className="max-w-xl">
      <h1 className="font-display text-3xl text-navy">Edit Customer</h1>
      <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
        <CustomerForm initialValues={initial} onSubmit={handleSubmit} submitting={submitting} error={error} />
      </div>
    </section>
  );
}
