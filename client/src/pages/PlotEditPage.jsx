import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as plotService from '../services/plot.service.js';
import * as customerService from '../services/customer.service.js';
import PlotForm from '../components/PlotForm.jsx';

export default function PlotEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialValues, setInitialValues] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      plotService.getPlot(id),
      customerService.listCustomers({ limit: 200 }),
    ])
      .then(([plot, r]) => {
        const { _id, createdAt, updatedAt, customerId, __v, ...rest } = plot;
        setInitialValues({ ...rest, customerId: customerId?._id || '' });
        setCustomers(r.items);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load plot.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(payload) {
    setSubmitting(true);
    setError('');
    try {
      await plotService.updatePlot(id, payload);
      navigate(`/plots/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update plot.');
      setSubmitting(false);
    }
  }

  if (loading) return <p className="font-mono text-sm text-navy/50">Loading…</p>;
  if (error && !initialValues)
    return <div className="rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{error}</div>;

  return (
    <section className="max-w-xl">
      <Link to={`/plots/${id}`} className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Plot
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">Edit Plot</h1>
      {initialValues && (
        <div className="mt-6">
          <PlotForm
            initialValues={initialValues}
            customers={customers}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={error}
          />
        </div>
      )}
    </section>
  );
}
