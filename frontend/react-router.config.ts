import type { Config } from "@react-router/dev/config";

export default {
  // kolibri is deployed as a client-rendered application behind CloudFront.
  ssr: false,
} satisfies Config;
