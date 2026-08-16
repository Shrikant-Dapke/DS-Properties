import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PartnerForm from '../components/PartnerForm.jsx';
import * as partnerService from '../services/partner.service.js';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../utils/errorMessage.js';

export default function PartnerCreatePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  async function handleSubmit(payload) {
    setSubmitting(true);
    setError('');
    try {
      const partner = await partnerService.createPartner(payload);
      toast.success('Partner created successfully.');
      navigate(`/partners/${partner._id}`);
    } catch (err) {
      setSubmitting(false);
      setError(getErrorMessage(err, 'Failed to create partner.'));
    }
  }

  return (
    <section className="max-w-xl">
      <Link to="/partners" className="font-mono text-xs uppercase tracking-wider text-lavender hover:underline">
        ← Partners
      </Link>
      <h1 className="mt-2 font-display text-3xl text-navy">New Partner</h1>
      <p className="mt-1 font-sans text-sm text-navy/60">
        Add a business partner. Track their capital contributions separately from customer payments and revenue.
      </p>
      <div className="mt-6">
        <PartnerForm onSubmit={handleSubmit} submitting={submitting} error={error} />
      </div>
    </section>
  );
}
