import React from 'react';
import type { DirectoryPage } from '@/lib/cms/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface DirectoryPageClientProps {
  directory: DirectoryPage;
}

export function DirectoryPageClient({ directory }: DirectoryPageClientProps) {
  return (
    <div className="space-y-8">
      {/* Directory Title and Description */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">{directory.title}</h1>
        {directory.description && (
          <p className="text-lg text-muted-foreground max-w-4xl mx-auto">
            {directory.description}
          </p>
        )}
      </div>

      {/* Business Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {directory.businesses?.map((business) => (
          <BusinessCard key={business.id} business={business} />
        ))}
      </div>

      {/* FAQs Section */}
      {directory.faqs && directory.faqs.length > 0 && (
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {directory.faqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}

interface BusinessCardProps {
  business: DirectoryPage['businesses'][number];
}

function BusinessCard({ business }: BusinessCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{business.name}</span>
          {business.rating && (
            <span className="text-yellow-500 font-bold">
              {business.rating.toFixed(1)}★
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {business.description && (
          <p className="text-sm text-muted-foreground mb-2">
            {business.description}
          </p>
        )}
        {business.address && (
          <p className="text-sm text-muted-foreground">
            {business.address}
          </p>
        )}
      </CardContent>
    </Card>
  );
}