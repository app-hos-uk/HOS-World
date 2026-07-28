import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { fetchServerShippingMethods } from '@/lib/fetchServerShippingMethods';
import {
  collectFreeShippingThresholds,
  formatPublicShippingRuleLine,
  getPrimaryRule,
} from '@/lib/shippingDisplay';
import { formatAdminPrice } from '@/lib/adminFormat';

export default async function ShippingPage() {
  const methods = await fetchServerShippingMethods();
  const freeThresholds = collectFreeShippingThresholds(methods);

  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">Shipping Information</h1>
        <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Shipping Options</h2>
            {methods.length === 0 ? (
              <p className="text-sm sm:text-base text-hos-text-secondary">
                Shipping rates are being configured. Exact costs are shown at checkout once available.
              </p>
            ) : (
              <>
                <p className="text-sm sm:text-base text-hos-text-secondary mb-4">
                  Rates reflect configured shipping methods. Destination-specific rules are labeled by country;
                  your exact options and cost are calculated at checkout based on your delivery address.
                </p>
                <div className="space-y-3 sm:space-y-4">
                {methods.map((method) => {
                  const activeRules = (method.rules ?? []).filter((rule) => rule.isActive);
                  const primaryRule = getPrimaryRule(method);

                  return (
                    <div key={method.id}>
                      <h3 className="text-lg sm:text-xl font-medium mb-2">{method.name}</h3>
                      {method.description && (
                        <p className="text-sm sm:text-base text-hos-text-secondary mb-1">{method.description}</p>
                      )}
                      {activeRules.length === 0 ? (
                        <p className="text-sm sm:text-base text-hos-text-secondary">Rates available at checkout.</p>
                      ) : activeRules.length === 1 && primaryRule ? (
                        <p className="text-sm sm:text-base text-hos-text-secondary">
                          {formatPublicShippingRuleLine(method, primaryRule)}
                        </p>
                      ) : (
                        <ul className="text-sm sm:text-base text-hos-text-secondary space-y-1 list-disc list-inside">
                          {activeRules.map((rule) => (
                            <li key={rule.id}>
                              {rule.name}: {formatPublicShippingRuleLine(method, rule)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                </div>
              </>
            )}
          </section>

          {freeThresholds.length > 0 && (
            <section>
              <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Free Shipping</h2>
              <div className="space-y-2 text-sm sm:text-base text-hos-text-secondary">
                {freeThresholds.map((threshold) => (
                  <p key={threshold}>
                    Free shipping on qualifying orders over {formatAdminPrice(threshold)}.
                  </p>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">International Shipping</h2>
            <p className="text-sm sm:text-base text-hos-text-secondary">
              We ship worldwide where available. International rates and delivery times depend on destination
              and are shown at checkout.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
