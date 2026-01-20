// src/index.ts
import * as admin from "firebase-admin";
admin.initializeApp();
export {retentionJob} from "./retentionJob";
export {trialJanitorJob} from "./trialJanitor";
