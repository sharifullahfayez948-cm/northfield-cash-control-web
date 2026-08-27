"use client";

import { useEffect, useState } from "react";

export default function CompanyBrand({ className = "", showName = false }) {
  const [company, setCompany] = useState({ company_name: "Northfield Veterinary Clinic", company_logo: "" });

  useEffect(() => {
    fetch("/api/public-settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setCompany(data))
      .catch(() => {});
  }, []);

  return <div className={`companyBrand ${className}`.trim()}>
    {company.company_logo ? <img src={company.company_logo} alt={company.company_name} /> : <div className="companyLogoFallback" aria-hidden="true">NF</div>}
    {showName && <strong>{company.company_name}</strong>}
  </div>;
}
