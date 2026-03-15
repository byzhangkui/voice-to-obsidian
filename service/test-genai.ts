import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config({path: "../.env"});
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
console.log(Object.keys(ai.files));
