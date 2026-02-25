import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

export const invokeBedrock = async (
  modelId: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId,
      body: JSON.stringify(input),
      contentType: "application/json",
      accept: "application/json",
    }),
  );

  return JSON.parse(new TextDecoder().decode(response.body));
};
