"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TierPricing, PricingTier, PRICING_TIERS } from "@/lib/pricing";

interface SubscriptionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PricingResponse {
  countryCode: string | null;
  tier: PricingTier;
  pricing: TierPricing;
}

const SubscriptionDialog = ({
  isOpen,
  onOpenChange,
}: SubscriptionDialogProps) => {
  const createCheckout = useAction(api.dodo.createCheckout);
  const [pricing, setPricing] = useState<TierPricing>(PRICING_TIERS.standard);
  const [tier, setTier] = useState<PricingTier>("standard");
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Fetch regional pricing when dialog opens
  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen]);

  const handleCheckout = async (isYearly: boolean) => {
    setIsCheckoutLoading(true);
    try {
      const baseUrl = window.location.origin;
      const productId = isYearly
        ? pricing.yearlyProductId
        : pricing.monthlyProductId;

      const { checkout_url } = await createCheckout({
        product_cart: [{ product_id: productId, quantity: 1 }],
        returnUrl: `${baseUrl}/success`,
      });

      if (!checkout_url) {
        throw new Error("Missing checkout_url in response");
      }
      window.location.href = checkout_url;
    } catch (error) {
      console.error("Failed to create checkout", error);
      setIsCheckoutLoading(false);
    }
  };

  const features = [
    "Unlimited Video Generation",
    "Video download",
    "Full access to video vault",
    "Includes full access to Foldex(The All-in-One Study App).",
    "Priority support",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogTitle>
          <p className="text-2xl text-center pt-4">
            Upgrade Your Learning Experience
          </p>
          {tier !== "standard" && pricing.discount && (
            <p className="text-sm text-center text-green-600 font-medium">
              🎉 Special pricing for your region: {pricing.discount}
            </p>
          )}
        </DialogTitle>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Monthly Plan */}
              <Card className="relative">
                <div className="flex flex-col h-full">
                  <CardHeader>
                    <CardTitle className="font-medium">Monthly</CardTitle>
                    <span className="my-3 block text-2xl font-semibold">
                      {pricing.monthlyPrice} / mo
                    </span>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-1">
                    <hr className="border-dashed" />
                    <ul className="list-outside space-y-3 text-sm">
                      {features.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="size-3 text-green-600 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter className="mt-4">
                    <Button
                      className="w-full cursor-pointer"
                      onClick={() => handleCheckout(false)}
                      disabled={isCheckoutLoading}
                    >
                      {isCheckoutLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Get Pro"
                      )}
                    </Button>
                  </CardFooter>
                </div>
              </Card>

              {/* Yearly Plan */}
              <Card className="relative border-primary">
                <div className="absolute top-3 right-4 bg-primary  px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                  Save 42%
                </div>
                <div className="flex flex-col h-full">
                  <CardHeader>
                    <CardTitle className="font-medium">Yearly</CardTitle>
                    <span className="text-lg font-semibold block">
                      {pricing.yearlyMonthly}/month
                    </span>
                    <span className="text-sm text-muted-foreground block">
                      {pricing.yearlyPrice}/year
                    </span>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-1">
                    <hr className="border-dashed" />
                    <ul className="list-outside space-y-3 text-sm">
                      {features.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="size-3 text-green-600 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter className="mt-4">
                    <Button
                      className="w-full cursor-pointer"
                      variant="default"
                      onClick={() => handleCheckout(true)}
                      disabled={isCheckoutLoading}
                    >
                      {isCheckoutLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Get Pro Yearly"
                      )}
                    </Button>
                  </CardFooter>
                </div>
              </Card>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionDialog;
