import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as plotService from '../services/plot.service.js';
import * as customerService from '../services/customer.service.js';
import PlotForm from '../components/PlotForm.jsx';
import Spinner from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';

export default function PlotEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [initialValues, setInitialValues] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      .catch((err) => setLoadError(err.response?.data?.message || 'Failed to load plot.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(payload) {
    setSubmitting(true);
    try {
      await plotService.updatePlot(id, payload);
      toast.success('Plot updated successfully.');
      navigate(`/plots/${id}`);
    } catch (err) {
      setSubmitting(false);
      toast.error(getErrorMessage(err, 'Failed to update plot.'));
    }
  }

  if (loading) return <Spinner size="sm" className="mt-6" />;
  if (loadError)
    return <div className="rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{loadError}</div>;

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
          />
        </div>
      )}
    </section>
  );
}
