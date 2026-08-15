import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CustomerForm from '../components/CustomerForm.jsx';
import Card from '../components/Card.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';
import * as customerService from '../services/customer.service.js';

export default function CustomerCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(payload) {
    setSubmitting(true);
    try {
      const customer = await customerService.createCustomer(payload);
      toast.success('Customer created successfully.');
      navigate(`/customers/${customer._id}`);
    } catch (err) {
      setSubmitting(false);
      toast.error(getErrorMessage(err, 'Failed to create customer.'));
    }
  }

  return (
    <section className="max-w-xl">
      <Link to="/customers" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Customers
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">New Customer</h1>
      <Card className="mt-6 p-6">
        <CustomerForm onSubmit={handleSubmit} submitting={submitting} />
      </Card>
    </section>
  );
}
