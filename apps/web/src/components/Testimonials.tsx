'use client';

const QUOTES = [
  {
    quote:
      'Finally one place that feels like the shop floor in New York — I can bundle gifts from two vendors in a single order.',
    author: 'Eilidh M.',
    city: 'Austin',
    rating: 5,
    verified: true,
  },
  {
    quote:
      "Love the franchise strips and how clearly each seller's ratings show up. Feels safer than random resale sites.",
    author: 'James T.',
    city: 'Chicago',
    rating: 5,
    verified: true,
  },
  {
    quote:
      'The collectibles section is dangerous for my wallet. Arrived in two days, well packed — display case is showroom quality.',
    author: 'Priya K.',
    city: 'Seattle',
    rating: 5,
    verified: true,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 mb-3" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < rating ? 'text-hos-gold' : 'text-hos-text-muted/40'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

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
                <StarRating rating={item.rating} />
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
              <footer className="mt-5 not-italic">
                <p className="text-hos-gold text-[13px] font-ui">
                  {item.author}, {item.city}
                </p>
                {item.verified ? (
                  <p className="text-hos-text-muted text-[11px] mt-1 font-ui flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-hos-new-green" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified buyer
                  </p>
                ) : null}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
