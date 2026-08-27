import "./globals.css";
import "./brand.css";
import "./premium.css";
export const metadata={title:"Northfield Cash Control",description:"Northfield Veterinary Clinic Cash Control",manifest:"/manifest.webmanifest",icons:{icon:"/app-icon.svg",apple:"/app-icon.svg"}};
export const viewport={themeColor:"#08243a"};
export default function RootLayout({children}){return <html lang="en"><body>{children}</body></html>}
