export async function run(client) {
  const settings = [
    { key: 'company_name', value: 'DS Properties', description: 'Business/company display name' },
    { key: 'currency', value: 'INR', description: 'Currency code used for financial display' },
    { key: 'opening_balance', value: '0', description: 'Opening cash balance at system start' },
    { key: 'financial_year_start_month', value: '4', description: 'Financial year start month (4 = April)' },
  ];

  for (const s of settings) {
    await client.query(
      `INSERT INTO app_settings (key, value, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING`,
      [s.key, JSON.stringify(s.value), s.description],
    );
  }
}