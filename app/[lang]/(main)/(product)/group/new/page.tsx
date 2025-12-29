import ProductGridCient from "@/components/product-grid-client";
import { AllSiteConfigs } from "@/config/site";
import { COMMON_PARAMS } from "@/lib/constants";
import { ProductListOfRecentQueryResult } from "@/lib/cms/types";
import { fetchProductListOfRecent } from "@/lib/cms/fetch";
import { Metadata } from "next";

interface NewPageProps {
    params: { lang: string; };
}

// https://nextjs.org/docs/app/api-reference/functions/generate-metadata
export async function generateMetadata({
    params,
}: NewPageProps): Promise<Metadata> {
    const { lang } = params;
    console.log('generateMetadata, lang:', lang);
    const siteConfig = AllSiteConfigs[lang];
    const currentUrl = `${siteConfig.url}/${lang}/group/new`;
    const canonicalUrl = `${siteConfig.url}/en/group/new`;

    return {
        title: "New",
        description: siteConfig.description,
        alternates: {
            canonical: canonicalUrl,
        },
    }
}

export default async function NewPage({ params }: NewPageProps) {
    // console.log('NewPage, params:', params); // params: { lang: 'en' }
    const { lang } = params;
    const queryParams = { ...COMMON_PARAMS, lang };
    // console.log('NewPage, language:', lang); // language: en
    // console.log('NewPage, queryParams:', queryParams); // queryParams: { defaultLocale: 'en', lang: 'en' }

    const productListQueryResult = await fetchProductListOfRecent({
        locale: lang as any,
        params: {
            ...queryParams,
            limit: 24
        }
    });

    return (
        <ProductGridCient lang={lang} itemList={productListQueryResult} />
    );
}