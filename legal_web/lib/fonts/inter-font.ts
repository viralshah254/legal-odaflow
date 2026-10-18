/** Production-only Inter — dev uses system font stack to avoid Google CDN fetches. */
import { Inter } from "next/font/google"

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const interFontVariable = inter.variable
