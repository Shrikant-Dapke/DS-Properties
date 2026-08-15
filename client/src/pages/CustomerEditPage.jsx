import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CustomerForm from '../components/CustomerForm.jsx';
import Card from '../components/Card.jsx';
import Spinner from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import * as customerService from '../services/customer.service.js';

export default function CustomerEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    customerService
      .getCustomer(id)
      .then(setInitial)
      .catch((err) => setLoadError(err.response?.data?.message || 'Failed to load customer.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(payload) {
    setSubmitting(true);
    try {
      await customerService.updateCustomer(id, payload);
      toast.success('Customer updated successfully.');
      navigate(`/customers/${id}`);
    } catch (err) {
      setSubmitting(false);
      toast.error(getErrorMessage(err, 'Failed to update customer.'));
    }
  }

  if (loading) return <Spinner size="sm" className="mt-6" />;
  if (loadError)
    return <div className="rounded border border-orange bg-orange/10 px-3 py-2 text-sm text-orange">{loadError}</div>;

  return (
    <section className="max-w-xl">
      <h1 className="font-display text-3xl text-navy">Edit Customer</h1>
      <Card className="mt-6 p-6">
        <CustomerForm initialValues={initial} onSubmit={handleSubmit} submitting={submitting} />
      </Card>
    </section>
  );
}
