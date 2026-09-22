"use client";

import { api } from "@/convex/_generated/api";
import { useAction, useQuery } from "convex/react";
import { Calendar, CreditCard } from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { PRICING_TIERS, PricingTier, TierPricing } from "@/lib/pricing";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface PricingResponse {
  countryCode: string | null;
  tier: PricingTier;
  pricing: TierPricing;
}

const BillingDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  // const billing = useQuery(api.polar.getsubscriptionstatus);
  // const products = useQuery(api.polar.getConfiguredProducts);
  // if (!products?.foldex_pro) {
  //   return (
  //     <div>
  //       <Skeleton className="h-2 w-4" />
  //     </div>
  //   );
  // }
  const billing = useQuery(api.customer.getstatus);
  const getPortal = useAction(api.dodo.getCustomerPortal);
  const createCheckout = useAction(api.dodo.createCheckout);

  const [pricing, setPricing] = useState<TierPricing>(PRICING_TIERS.standard);
  const [tier, setTier] = useState<PricingTier>("standard");
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Fetch regional pricing when dialog opens
  useEffect(() => {
    fetch("/api/pricing")
      .then((res) => res.json())
      .then((data: PricingResponse) => {
        setPricing(data.pricing);
        setTier(data.tier);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch pricing:", err);
        setIsLoading(false);
      });
  }, []);

  const handlePortal = async () => {
    try {
      const { portal_url } = await getPortal({ send_email: false });
      if (!portal_url) {
        throw new Error("Missing portal_url in response");
      }
      window.location.href = portal_url;
    } catch (error) {
      console.error("Unable to open customer portal", error);
      alert("We couldn't open the customer portal. Please try again.");
    }
  };
  const handleCheckout = async () => {
    try {
      const baseUrl = window.location.origin;
      const { checkout_url } = await createCheckout({
        product_cart: [{ product_id: pricing.monthlyProductId, quantity: 1 }],
        returnUrl: `${baseUrl}/success`,
      });
      if (!checkout_url) {
        throw new Error("Missing checkout_url in response");
      }
      window.location.href = checkout_url;
    } catch (error) {
      console.error("Failed to create checkout", error);
      throw new Error("Unable to create checkout. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Billing</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4 h-full py-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex p-4 bg-primary/10 rounded-2xl flex-col gap-2">
              <p className="text-xl text-primary font-semibold">
                {" "}
                Current Subscription{" "}
              </p>
              <p>{billing?.tier !== "pro" ? "Free" : "Pro"}</p>
            </div>
            <div className="flex p-4 bg-primary/10 rounded-2xl flex-col gap-2">
              <p className="text-xl text-primary font-semibold">
                {" "}
                Current Plan{" "}
              </p>
              <p>{billing?.tier !== "pro" ? "Free" : "Pro"}</p>
            </div>
          </div>
          {billing?.tier === "pro" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Renews on{" "}
                  {format(new Date(billing?.currentPeriodEnd || ""), "PPP")}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-center ">
            {billing?.tier === "pro" ? (
              <Button onClick={handlePortal} className="cursor-pointer w-full">
                Manage Subscription
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                {tier !== "standard" && pricing.discount && (
                  <p className="text-sm text-center text-green-600 font-medium">
                    🎉 Special pricing for your region: {pricing.discount}
                  </p>
                )}
                <Button
                  onClick={handleCheckout}
                  className="cursor-pointer w-full"
                >
                  Upgrade to pro
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BillingDialog;
