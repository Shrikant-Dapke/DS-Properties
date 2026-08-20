const CATEGORIES = [
  { name: 'Road Construction', slug: 'road-construction', description: 'Road and approach construction expenses', sortOrder: 1 },
  { name: 'Gutter Work', slug: 'gutter-work', description: 'Gutter and drainage work expenses', sortOrder: 2 },
  { name: 'Electricity', slug: 'electricity', description: 'Electricity and electrification expenses', sortOrder: 3 },
  { name: 'Water', slug: 'water', description: 'Water supply and borewell expenses', sortOrder: 4 },
  { name: 'Labor', slug: 'labor', description: 'Labor charges for site work', sortOrder: 5 },
  { name: 'Legal', slug: 'legal', description: 'Legal, documentation and registration expenses', sortOrder: 6 },
  { name: 'Other', slug: 'other', description: 'Any other business expense', sortOrder: 99 },
];

export async function run(client) {
  for (const cat of CATEGORIES) {
    await client.query(
      `INSERT INTO expense_categories (name, slug, description, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [cat.name, cat.slug, cat.description, cat.sortOrder],
    );
  }
}