'use client';

const QUOTES = [
  {
    quote:
      'Finally one place that feels like the shop floor in New York — I can bundle gifts from two vendors in a single order.',
    author: 'Eilidh M.',
    city: 'Austin',
  },
  {
    quote:
      "Love the franchise strips and how clearly each seller's ratings show up. Feels safer than random resale sites.",
    author: 'James T.',
    city: 'Chicago',
  },
  {
    quote:
      'The collectibles section is dangerous for my wallet. Arrived in two days, well packed — display case is showroom quality.',
    author: 'Priya K.',
    city: 'Seattle',
  },
];

export default function Testimonials() {
  return (
    <section className="bg-hos-bg py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="section-head mb-10">
          <h2 className="font-display text-hos-gold-hover text-2xl md:text-3xl">
            Why fans shop with us
          </h2>
          <p className="text-hos-text-muted text-sm mt-2 font-body">
            Voices from collectors and fans in our community.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {QUOTES.map((item) => (
            <blockquote
              key={item.author}
              className="bg-hos-bg-secondary border border-hos-border rounded-xl p-7 flex flex-col justify-between"
            >
              <div>
                <span
                  className="text-hos-gold text-3xl font-serif leading-none mb-3 block"
                  aria-hidden
                >
                  ❝
                </span>
                <p className="text-hos-text-secondary text-sm italic leading-relaxed font-body">
                  {item.quote}
                </p>
              </div>
              <footer className="text-hos-gold text-[13px] mt-5 font-ui not-italic">
                {item.author}, {item.city}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
