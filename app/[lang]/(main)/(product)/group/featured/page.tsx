import ProductGridCient from "@/components/product-grid-client";
import { AllSiteConfigs } from "@/config/site";
import { COMMON_PARAMS } from "@/lib/constants";
import { ProductListOfFeaturedQueryResult } from "@/lib/cms/types";
import { fetchProductListOfFeatured } from "@/lib/cms/fetch";
import { Metadata } from "next";

interface FeaturedPageProps {
    params: { lang: string; };
}

// https://nextjs.org/docs/app/api-reference/functions/generate-metadata
export async function generateMetadata({
    params,
}: FeaturedPageProps): Promise<Metadata> {
    const { lang } = params;
    console.log('generateMetadata, lang:', lang);
    const siteConfig = AllSiteConfigs[lang];
    const currentUrl = `${siteConfig.url}/${lang}/group/featured`;
    const canonicalUrl = `${siteConfig.url}/en/group/featured`;

    return {
        title: "Featured",
        description: siteConfig.description,
        alternates: {
            canonical: canonicalUrl,
        },
    }
}

export default async function FeaturedPage({ params }: FeaturedPageProps) {
    // console.log('FeaturedPage, params:', params); // params: { lang: 'en' }
    const { lang } = params;
    const queryParams = { ...COMMON_PARAMS, lang };
    // console.log('FeaturedPage, language:', lang); // language: en
    // console.log('FeaturedPage, queryParams:', queryParams); // queryParams: { defaultLocale: 'en', lang: 'en' }

    const productListQueryResult = await fetchProductListOfFeatured({
        locale: lang as any,
        params: {
            ...queryParams,
            limit: 48
        }
    });

    return (
        <ProductGridCient lang={lang} itemList={productListQueryResult} />
    );
}