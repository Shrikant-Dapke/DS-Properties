import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerForm from '../components/CustomerForm.jsx';
import * as customerService from '../services/customer.service.js';

export default function CustomerCreatePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(payload) {
    setSubmitting(true);
    setError('');
    try {
      const customer = await customerService.createCustomer(payload);
      navigate(`/customers/${customer._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create customer.');
      setSubmitting(false);
    }
  }

  return (
    <section className="max-w-xl">
      <h1 className="font-display text-3xl text-navy">New Customer</h1>
      <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
        <CustomerForm onSubmit={handleSubmit} submitting={submitting} error={error} />
      </div>
    </section>
  );
}
