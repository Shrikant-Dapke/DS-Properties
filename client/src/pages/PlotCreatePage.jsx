import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as plotService from '../services/plot.service.js';
import * as customerService from '../services/customer.service.js';
import PlotForm from '../components/PlotForm.jsx';

export default function PlotCreatePage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    customerService
      .listCustomers({ limit: 200 })
      .then((r) => setCustomers(r.items))
      .catch(() => {});
  }, []);

  async function handleSubmit(payload) {
    setSubmitting(true);
    setError('');
    try {
      const plot = await plotService.createPlot(payload);
      navigate(`/plots/${plot._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create plot.');
      setSubmitting(false);
    }
  }

  return (
    <section className="max-w-xl">
      <Link to="/plots" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Plots
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">New Plot</h1>
      <div className="mt-6">
        <PlotForm customers={customers} onSubmit={handleSubmit} submitting={submitting} error={error} />
      </div>
    </section>
  );
}
