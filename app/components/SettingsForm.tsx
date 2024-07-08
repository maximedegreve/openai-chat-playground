import React, { useRef, useCallback } from "react";
import type { FormEvent } from "react";
import {
  RadioGroup,
  Radio,
  CheckboxGroup,
  FormControl,
  Box,
  Button,
  Checkbox,
  Select,
  Textarea,
} from "@primer/react";
import type { ChatCompletionCreateParams } from "openai/resources/chat";
import { availableFunctions, FunctionName } from "../api/chat/functions";
import { Provider, type Model, type SettingsProps } from "../types";
import { indexedRepositories } from "../repositories";
import { FUNCTION_CALLING_MODELS } from "../models";
import { Visibility } from "./TitleBar";
import { presentProvider } from "../utils/provider";

type Props = {
  initialValues: SettingsProps;
  setSettingsVisibility: (visibility: Visibility) => void;
  onSubmit: (s: SettingsProps) => void;
};

function RepositoryOption({
  repository,
  checked,
}: {
  checked: boolean;
  repository: string;
}) {
  return (
    <Box
      sx={{
        py: 1,
      }}
    >
      <FormControl key={repository}>
        <Checkbox
          value={repository}
          name="repositories[]"
          disabled={true}
          defaultChecked={checked}
        />
        <FormControl.Label>
          <Box>{repository}</Box>
        </FormControl.Label>
      </FormControl>
    </Box>
  );
}

function ToolOption({
  tool,
  checked,
}: {
  checked: boolean;
  tool: ChatCompletionCreateParams.Function;
}) {
  return (
    <Box
      sx={{
        py: 1,
      }}
    >
      <FormControl key={tool.name}>
        <Checkbox value={tool.name} name="tools[]" defaultChecked={checked} />
        <FormControl.Label>
          <Box>{tool.name}</Box>
        </FormControl.Label>
      </FormControl>
    </Box>
  );
}

export default function SettingsForm({
  initialValues,
  setSettingsVisibility,
  onSubmit,
}: Props) {
  const form = useRef<HTMLFormElement>(null);
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const data = new FormData(form.current!);
      const customInstructions = (
        data.get("customInstructions") as string
      ).trim();
      const tools = data.getAll("tools[]") as FunctionName[];
      const model = data.get("model") as Model;
      const provider = data.get("provider") as Provider;
      const parallelize = data.get("fcStrategy") === "parallel";
      onSubmit({
        customInstructions,
        tools,
        model,
        parallelize,
        provider,
      });
      //onDismiss();
    },
    [onSubmit],
  );

  return (
    <Box
      sx={{
        width: "480px",
        flexShrink: 0,
        height: "100%",
        borderRight: "1px solid",
        borderColor: "border.default",
        overflowY: "scroll",
      }}
    >
      <Box
        as="form"
        onSubmit={handleSubmit}
        ref={form}
        sx={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          height: "100%",
        }}
      >
        <Box sx={{ flexGrow: 1, p: 3, overflowY: "scroll" }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              gap: 2,
              fontSize: 3,
              fontWeight: "semibold",
              color: "fg.default",
              pb: 3,
            }}
          >
            <Box sx={{ flexGrow: 1 }}>Settings</Box>
          </Box>
          <FormControl>
            <FormControl.Label>Provider</FormControl.Label>
            <Select name="provider" sx={{ width: "100%" }}>
              {Object.values(Provider).map((provider) => (
                <Select.Option
                  selected={provider == initialValues.provider}
                  key={provider}
                  value={provider}
                >
                  {presentProvider(provider)}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
          <Box pt={3}>
            <FormControl>
              <FormControl.Label>Model (OpenAI only)</FormControl.Label>
              <Select name="model" sx={{ width: "100%" }}>
                {FUNCTION_CALLING_MODELS.map((model) => (
                  <Select.Option
                    selected={model === initialValues.model}
                    key={model}
                    value={model}
                  >
                    {model}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box pt={3}>
            <FormControl id="customInstructions">
              <FormControl.Label>Custom instructions</FormControl.Label>
              <Textarea
                resize="vertical"
                rows={16}
                sx={{ width: "100%", whiteSpace: "pre-wrap" }}
                name="customInstructions"
                defaultValue={initialValues.customInstructions}
                placeholder="Enter custom instructions"
              />
            </FormControl>
          </Box>
          <Box pt={3}>
            <RadioGroup name="fcStrategy">
              <RadioGroup.Label>
                Function calling strategy (OpenAI only)
              </RadioGroup.Label>
              <CheckboxGroup.Caption>
                Select whether a serial or parallel function calling strategy is
                used. Parallel is not always better...or faster.
              </CheckboxGroup.Caption>
              <FormControl>
                <Radio
                  value="parallel"
                  defaultChecked={initialValues.parallelize}
                />
                <FormControl.Label>Tools (parallel)</FormControl.Label>
              </FormControl>
              <FormControl>
                <Radio
                  value="serial"
                  defaultChecked={!initialValues.parallelize}
                />
                <FormControl.Label>Functions (serial)</FormControl.Label>
              </FormControl>
            </RadioGroup>
          </Box>
          <Box display="grid" pt={3} sx={{ gap: 4 }}>
            <CheckboxGroup>
              <CheckboxGroup.Label>Tool selection</CheckboxGroup.Label>
              <CheckboxGroup.Caption>
                Select which tools are available to the model in this
                conversation
              </CheckboxGroup.Caption>
              <Box>
                {Object.keys(availableFunctions).map((toolName) => {
                  const functionName = toolName as FunctionName;
                  const tool = availableFunctions[functionName]
                    .meta as ChatCompletionCreateParams.Function;
                  return (
                    <ToolOption
                      checked={initialValues.tools.includes(
                        tool.name as FunctionName,
                      )}
                      tool={tool}
                    />
                  );
                })}
              </Box>
            </CheckboxGroup>
          </Box>
          <Box display="grid" pt={3} sx={{ gap: 4 }}>
            <CheckboxGroup>
              <CheckboxGroup.Label>Retrieval</CheckboxGroup.Label>
              <CheckboxGroup.Caption>
                Only the following repositories have been indexed for similarity
                search.
              </CheckboxGroup.Caption>
              <Box>
                {Object.entries(indexedRepositories).map(
                  ([repository, ref]) => (
                    <RepositoryOption
                      checked={
                        true /*initialValues.repositories.includes(repository)*/
                      }
                      repository={repository}
                    />
                  ),
                )}
              </Box>
            </CheckboxGroup>
          </Box>
        </Box>
        <Box
          sx={{
            borderTop: "1px solid",
            borderColor: "border.default",
            flexGrow: 0,
            p: 3,
            justifyContent: "flex-end",
            display: "flex",
            gap: "8px",
          }}
        >
          <Button
            type="reset"
            size="large"
            variant="default"
            onClick={() => {
              setSettingsVisibility("hidden");
            }}
          >
            Cancel
          </Button>
          <Button size="large" type="submit" variant="primary">
            Apply
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
