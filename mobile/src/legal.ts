import { Linking } from "react-native";
import { API_URL } from "./api";

// Legal pages are served by the web app at these exact routes.
export const PRIVACY_URL = `${API_URL}/privacy-policy`;
export const TERMS_URL = `${API_URL}/terms-of-service`;
export const SUPPORT_EMAIL = "support@fusioncouples.co.uk";

export const openPrivacy = () => Linking.openURL(PRIVACY_URL).catch(() => {});
export const openTerms = () => Linking.openURL(TERMS_URL).catch(() => {});
