import {
  Noto_Sans,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Noto_Nastaliq_Urdu,
} from "next/font/google"

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-noto" })
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
})
const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali",
})
const notoTamil = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--font-tamil" })
const notoTelugu = Noto_Sans_Telugu({ subsets: ["telugu"], variable: "--font-telugu" })
const notoUrdu = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-urdu",
  weight: "400",
})

export const productionFontVariables = [
  notoSans.variable,
  notoDevanagari.variable,
  notoBengali.variable,
  notoTamil.variable,
  notoTelugu.variable,
  notoUrdu.variable,
].join(" ")
