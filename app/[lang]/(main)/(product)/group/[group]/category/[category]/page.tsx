import ProductGridCient from "@/components/product-grid-client";
import { AllSiteConfigs } from "@/config/site";
import { COMMON_PARAMS } from "@/lib/constants";
import { CategoryQueryResult, ProductData } from "@/lib/cms/types";
import { fetchCategory, fetchProductsByCategory } from "@/lib/cms/fetch";
import { Metadata } from "next";

interface CategoryPageProps {
    params: {
        lang: string;
        group: string;
        category: string;
    }
}

// https://nextjs.org/docs/app/api-reference/functions/generate-metadata
export async function generateMetadata({
    params,
}: CategoryPageProps): Promise<Metadata> {
    const { lang, group, category } = params;
    // console.log('generateMetadata, lang:', lang, ', group:', group, ', category:', category);
    const queryParams = { ...COMMON_PARAMS, lang };
    // console.log('generateMetadata, queryParams:', queryParams); // queryParams: { defaultLocale: 'en', lang: 'en' }

    const categoryQueryResult = await fetchCategory({
        slug: category,
        locale: lang as any,
        params: queryParams,
    });
    console.log('generateMetadata, categoryQueryResult:', categoryQueryResult);
    if (!categoryQueryResult) {
        return {};
    }

    const siteConfig = AllSiteConfigs[lang];
    const currentUrl = `${siteConfig.url}/${lang}/group/${group}/category/${category}`;
    const canonicalUrl = `${siteConfig.url}/en/group/${group}/category/${category}`;

    return {
        title: categoryQueryResult.name,
        description: siteConfig.description,
        alternates: {
            canonical: canonicalUrl,
        },
    }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
    console.log('CategoryPage, params:', params); // params: { lang: 'en' }
    const { lang, group, category } = params;
    console.log('CategoryPage, group:', group, ', category:', category);
    const queryParams = { ...COMMON_PARAMS, lang };
    // console.log('CategoryPage, language:', lang); // language: en
    // console.log('CategoryPage, queryParams:', queryParams); // queryParams: { defaultLocale: 'en', lang: 'en' }

    const productListQueryResult = await fetchProductsByCategory({
        categorySlug: category,
        locale: lang as any,
        params: queryParams,
    });

    return (
        <ProductGridCient lang={lang} itemList={productListQueryResult} />
    );
}