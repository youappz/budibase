<script>
  import TableSelector from "./TableSelector.svelte"
  import RowSelector from "./RowSelector.svelte"
  import FieldSelector from "./FieldSelector.svelte"
  import SchemaSetup from "./SchemaSetup.svelte"
  import {
    Button,
    Input,
    Select,
    Label,
    ActionButton,
    Drawer,
    Modal,
    notifications,
    Icon,
    Checkbox,
    DatePicker,
    Detail,
  } from "@budibase/bbui"
  import CreateWebhookModal from "components/automation/Shared/CreateWebhookModal.svelte"
  import { automationStore, selectedAutomation } from "builderStore"
  import { tables } from "stores/backend"
  import { environment, licensing } from "stores/portal"
  import WebhookDisplay from "../Shared/WebhookDisplay.svelte"
  import DrawerBindableInput from "../../common/bindings/DrawerBindableInput.svelte"
  import DrawerBindableSlot from "../../common/bindings/DrawerBindableSlot.svelte"
  import AutomationBindingPanel from "../../common/bindings/ServerBindingPanel.svelte"
  import CodeEditorModal from "./CodeEditorModal.svelte"
  import QuerySelector from "./QuerySelector.svelte"
  import QueryParamSelector from "./QueryParamSelector.svelte"
  import AutomationSelector from "./AutomationSelector.svelte"
  import CronBuilder from "./CronBuilder.svelte"
  import Editor from "components/integration/QueryEditor.svelte"
  import ModalBindableInput from "components/common/bindings/ModalBindableInput.svelte"
  import CodeEditor from "components/common/CodeEditor/CodeEditor.svelte"
  import {
    bindingsToCompletions,
    hbAutocomplete,
    EditorModes,
  } from "components/common/CodeEditor"
  import FilterDrawer from "components/design/settings/controls/FilterEditor/FilterDrawer.svelte"
  import { LuceneUtils, Utils } from "@budibase/frontend-core"
  import {
    getSchemaForDatasourcePlus,
    getEnvironmentBindings,
  } from "builderStore/dataBinding"
  import { TriggerStepID, ActionStepID } from "constants/backend/automations"
  import { onMount } from "svelte"
  import { cloneDeep } from "lodash/fp"

  export let block
  export let testData
  export let schemaProperties
  export let isTestModal = false
  let webhookModal
  let drawer
  let fillWidth = true
  let inputData
  let codeBindingOpen = false
  $: filters = lookForFilters(schemaProperties) || []
  $: tempFilters = filters
  $: stepId = block.stepId
  $: bindings = getAvailableBindings(block, $selectedAutomation?.definition)
  $: getInputData(testData, block.inputs)
  $: tableId = inputData ? inputData.tableId : null
  $: table = tableId
    ? $tables.list.find(table => table._id === inputData.tableId)
    : { schema: {} }
  $: schema = getSchemaForDatasourcePlus(tableId, {
    searchableSchema: true,
  }).schema
  $: schemaFields = Object.values(schema || {})
  $: queryLimit = tableId?.includes("datasource") ? "∞" : "1000"
  $: isTrigger = block?.type === "TRIGGER"
  $: isUpdateRow = stepId === ActionStepID.UPDATE_ROW
  $: codeMode =
    stepId === "EXECUTE_BASH" ? EditorModes.Handlebars : EditorModes.JS

  $: stepCompletions =
    codeMode === EditorModes.Handlebars
      ? [hbAutocomplete([...bindingsToCompletions(bindings, codeMode)])]
      : []

  const getInputData = (testData, blockInputs) => {
    // Test data is not cloned for reactivity
    let newInputData = testData || cloneDeep(blockInputs)

    // Ensures the app action fields are populated
    if (block.event === "app:trigger" && !newInputData?.fields) {
      newInputData = cloneDeep(blockInputs)
    }

    inputData = newInputData
    setDefaultEnumValues()
  }

  const setDefaultEnumValues = () => {
    for (const [key, value] of schemaProperties) {
      if (value.type === "string" && value.enum && inputData[key] == null) {
        inputData[key] = value.enum[0]
      }
    }
  }
  const onChange = Utils.sequential(async (e, key) => {
    // We need to cache the schema as part of the definition because it is
    // used in the server to detect relationships. It would be far better to
    // instead fetch the schema in the backend at runtime.
    let schema
    if (e.detail?.tableId) {
      schema = getSchemaForDatasourcePlus(e.detail.tableId, {
        searchableSchema: true,
      }).schema
    }

    try {
      if (isTestModal) {
        let newTestData = { schema }

        // Special case for webhook, as it requires a body, but the schema already brings back the body's contents
        if (stepId === TriggerStepID.WEBHOOK) {
          newTestData = {
            ...newTestData,
            body: {
              [key]: e.detail,
              ...$selectedAutomation.testData?.body,
            },
          }
        }
        newTestData = {
          ...newTestData,
          [key]: e.detail,
        }
        await automationStore.actions.addTestDataToAutomation(newTestData)
      } else {
        const data = { schema, [key]: e.detail }
        await automationStore.actions.updateBlockInputs(block, data)
      }
    } catch (error) {
      notifications.error("Error saving automation")
    }
  })

  function getAvailableBindings(block, automation) {
    if (!block || !automation) {
      return []
    }

    // Find previous steps to the selected one
    let allSteps = [...automation.steps]

    if (automation.trigger) {
      allSteps = [automation.trigger, ...allSteps]
    }
    let blockIdx = allSteps.findIndex(step => step.id === block.id)

    // Extract all outputs from all previous steps as available bindingsx§x
    let bindings = []
    let loopBlockCount = 0
    const addBinding = (name, value, icon, idx, isLoopBlock, bindingName) => {
      const runtimeBinding = determineRuntimeBinding(name, idx, isLoopBlock)
      const categoryName = determineCategoryName(idx, isLoopBlock, bindingName)

      bindings.push(
        createBindingObject(
          name,
          value,
          icon,
          idx,
          loopBlockCount,
          isLoopBlock,
          runtimeBinding,
          categoryName,
          bindingName
        )
      )
    }

    const determineRuntimeBinding = (name, idx, isLoopBlock) => {
      let runtimeName

      /* Begin special cases for generating custom schemas based on triggers */
      if (idx === 0 && automation.trigger?.event === "app:trigger") {
        return `trigger.fields.${name}`
      }

      if (
        (idx === 0 && automation.trigger?.event === "row:update") ||
        automation.trigger?.event === "row:save"
      ) {
        if (name !== "id" && name !== "revision") return `trigger.row.${name}`
      }
      /* End special cases for generating custom schemas based on triggers */

      if (isLoopBlock) {
        runtimeName = `loop.${name}`
      } else if (block.name.startsWith("JS")) {
        runtimeName = `steps[${idx - loopBlockCount}].${name}`
      } else {
        runtimeName = `steps.${idx - loopBlockCount}.${name}`
      }
      return idx === 0 ? `trigger.${name}` : runtimeName
    }

    const determineCategoryName = (idx, isLoopBlock, bindingName) => {
      if (idx === 0) return "Trigger outputs"
      if (isLoopBlock) return "Loop Outputs"
      return bindingName
        ? `${bindingName} outputs`
        : `Step ${idx - loopBlockCount} outputs`
    }

    const createBindingObject = (
      name,
      value,
      icon,
      idx,
      loopBlockCount,
      isLoopBlock,
      runtimeBinding,
      categoryName,
      bindingName
    ) => {
      return {
        readableBinding: bindingName
          ? `${bindingName}.${name}`
          : runtimeBinding,
        runtimeBinding,
        type: value.type,
        description: value.description,
        icon,
        category: categoryName,
        display: {
          type: value.type,
          name,
          rank: isLoopBlock ? idx + 1 : idx - loopBlockCount,
        },
      }
    }

    for (let idx = 0; idx < blockIdx; idx++) {
      let wasLoopBlock = allSteps[idx - 1]?.stepId === ActionStepID.LOOP
      let isLoopBlock =
        allSteps[idx]?.stepId === ActionStepID.LOOP &&
        allSteps.some(x => x.blockToLoop === block.id)
      let schema = cloneDeep(allSteps[idx]?.schema?.outputs?.properties) ?? {}
      let bindingName =
        automation.stepNames?.[allSteps[idx - loopBlockCount].id]

      if (isLoopBlock) {
        schema = {
          currentItem: {
            type: "string",
            description: "the item currently being executed",
          },
        }
      }

      if (idx === 0 && automation.trigger?.event === "app:trigger") {
        schema = Object.fromEntries(
          Object.keys(automation.trigger.inputs.fields || []).map(key => [
            key,
            { type: automation.trigger.inputs.fields[key] },
          ])
        )
      }
      if (
        (idx === 0 && automation.trigger.event === "row:update") ||
        (idx === 0 && automation.trigger.event === "row:save")
      ) {
        let table = $tables.list.find(
          table => table._id === automation.trigger.inputs.tableId
        )
        // We want to generate our own schema for the bindings from the table schema itself
        for (const key in table?.schema) {
          schema[key] = {
            type: table.schema[key].type,
          }
        }
        // remove the original binding
        delete schema.row
      }
      let icon =
        idx === 0
          ? automation.trigger.icon
          : isLoopBlock
          ? "Reuse"
          : allSteps[idx].icon

      if (wasLoopBlock) {
        loopBlockCount++
        continue
      }

      Object.entries(schema).forEach(([name, value]) =>
        addBinding(name, value, icon, idx, isLoopBlock, bindingName)
      )
    }

    // Environment bindings
    if ($licensing.environmentVariablesEnabled) {
      bindings = bindings.concat(
        getEnvironmentBindings().map(binding => {
          return {
            ...binding,
            display: {
              ...binding.display,
              rank: 98,
            },
          }
        })
      )
    }
    return bindings
  }
  function lookForFilters(properties) {
    if (!properties) {
      return []
    }
    let filters
    const inputs = testData ? testData : block.inputs
    for (let [key, field] of properties) {
      // need to look for the builder definition (keyed separately, see saveFilters)
      const defKey = `${key}-def`
      if (field.customType === "filters" && inputs?.[defKey]) {
        filters = inputs[defKey]
        break
      }
    }
    return filters || []
  }

  function saveFilters(key) {
    const filters = LuceneUtils.buildLuceneQuery(tempFilters)
    const defKey = `${key}-def`
    onChange({ detail: filters }, key)
    // need to store the builder definition in the automation
    onChange({ detail: tempFilters }, defKey)
    drawer.hide()
  }

  function canShowField(key, value) {
    const dependsOn = value?.dependsOn
    return !dependsOn || !!inputData[dependsOn]
  }

  function shouldRenderField(value) {
    return (
      value.customType !== "row" &&
      value.customType !== "code" &&
      value.customType !== "queryParams" &&
      value.customType !== "cron" &&
      value.customType !== "triggerSchema" &&
      value.customType !== "automationFields"
    )
  }

  onMount(async () => {
    try {
      await environment.loadVariables()
    } catch (error) {
      console.error(error)
    }
  })
</script>

<div class="fields">
  {#each schemaProperties as [key, value]}
    {#if canShowField(key, value)}
      <div class:block-field={shouldRenderField(value)}>
        {#if key !== "fields" && value.type !== "boolean" && shouldRenderField(value)}
          <Label
            tooltip={value.title === "Binding / Value"
              ? "If using the String input type, please use a comma or newline separated string"
              : null}>{value.title || (key === "row" ? "Table" : key)}</Label
          >
        {/if}
        <div class:field-width={shouldRenderField(value)}>
          {#if value.type === "string" && value.enum && canShowField(key, value)}
            <Select
              on:change={e => onChange(e, key)}
              value={inputData[key]}
              placeholder={false}
              options={value.enum}
              getOptionLabel={(x, idx) =>
                value.pretty ? value.pretty[idx] : x}
            />
          {:else if value.type === "json"}
            <Editor
              editorHeight="250"
              editorWidth="448"
              mode="json"
              value={inputData[key]?.value}
              on:change={e => {
                onChange(e, key)
              }}
            />
          {:else if value.type === "boolean"}
            <div style="margin-top: 10px">
              <Checkbox
                text={value.title}
                value={inputData[key]}
                on:change={e => onChange(e, key)}
              />
            </div>
          {:else if value.type === "date"}
            <DrawerBindableSlot
              fillWidth
              title={value.title}
              panel={AutomationBindingPanel}
              type={"date"}
              value={inputData[key]}
              on:change={e => onChange(e, key)}
              {bindings}
              allowJS={true}
              updateOnChange={false}
              drawerLeft="260px"
            >
              <DatePicker
                value={inputData[key]}
                on:change={e => onChange(e, key)}
              />
            </DrawerBindableSlot>
          {:else if value.customType === "column"}
            <Select
              on:change={e => onChange(e, key)}
              value={inputData[key]}
              options={Object.keys(table?.schema || {})}
            />
          {:else if value.customType === "filters"}
            <ActionButton on:click={drawer.show}>Define filters</ActionButton>
            <Drawer bind:this={drawer} {fillWidth} title="Filtering">
              <Button cta slot="buttons" on:click={() => saveFilters(key)}>
                Save
              </Button>
              <FilterDrawer
                slot="body"
                {filters}
                {bindings}
                {schemaFields}
                datasource={{ type: "table", tableId }}
                panel={AutomationBindingPanel}
                fillWidth
                on:change={e => (tempFilters = e.detail)}
              />
            </Drawer>
          {:else if value.customType === "password"}
            <Input
              type="password"
              on:change={e => onChange(e, key)}
              value={inputData[key]}
            />
          {:else if value.customType === "email"}
            {#if isTestModal}
              <ModalBindableInput
                title={value.title}
                value={inputData[key]}
                panel={AutomationBindingPanel}
                type="email"
                on:change={e => onChange(e, key)}
                {bindings}
                fillWidth
                updateOnChange={false}
              />
            {:else}
              <DrawerBindableInput
                fillWidth
                title={value.title}
                panel={AutomationBindingPanel}
                type="email"
                value={inputData[key]}
                on:change={e => onChange(e, key)}
                {bindings}
                allowJS={false}
                updateOnChange={false}
                drawerLeft="260px"
              />
            {/if}
          {:else if value.customType === "query"}
            <QuerySelector
              on:change={e => onChange(e, key)}
              value={inputData[key]}
            />
          {:else if value.customType === "cron"}
            <CronBuilder
              on:change={e => onChange(e, key)}
              value={inputData[key]}
            />
          {:else if value.customType === "automationFields"}
            <AutomationSelector
              on:change={e => onChange(e, key)}
              value={inputData[key]}
              {bindings}
            />
          {:else if value.customType === "queryParams"}
            <QueryParamSelector
              on:change={e => onChange(e, key)}
              value={inputData[key]}
              {bindings}
            />
          {:else if value.customType === "table"}
            <TableSelector
              {isTrigger}
              value={inputData[key]}
              on:change={e => onChange(e, key)}
            />
          {:else if value.customType === "row"}
            <RowSelector
              value={inputData[key]}
              meta={inputData["meta"] || {}}
              on:change={e => {
                if (e.detail?.key) {
                  onChange(e, e.detail.key)
                } else {
                  onChange(e, key)
                }
              }}
              {bindings}
              {isTestModal}
              {isUpdateRow}
            />
          {:else if value.customType === "webhookUrl"}
            <WebhookDisplay
              on:change={e => onChange(e, key)}
              value={inputData[key]}
            />
          {:else if value.customType === "fields"}
            <FieldSelector
              {block}
              value={inputData[key]}
              on:change={e => onChange(e, key)}
              {bindings}
              {isTestModal}
            />
          {:else if value.customType === "triggerSchema"}
            <SchemaSetup
              on:change={e => onChange(e, key)}
              value={inputData[key]}
            />
          {:else if value.customType === "code"}
            <CodeEditorModal>
              {#if codeMode == EditorModes.JS}
                <ActionButton
                  on:click={() => (codeBindingOpen = !codeBindingOpen)}
                  quiet
                  icon={codeBindingOpen ? "ChevronDown" : "ChevronRight"}
                >
                  <Detail size="S">Bindings</Detail>
                </ActionButton>
                {#if codeBindingOpen}
                  <pre>{JSON.stringify(bindings, null, 2)}</pre>
                {/if}
              {/if}
              <CodeEditor
                value={inputData[key]}
                on:change={e => {
                  // need to pass without the value inside
                  onChange({ detail: e.detail }, key)
                  inputData[key] = e.detail
                }}
                completions={stepCompletions}
                mode={codeMode}
                autocompleteEnabled={codeMode != EditorModes.JS}
                height={500}
              />
              <div class="messaging">
                {#if codeMode == EditorModes.Handlebars}
                  <Icon name="FlashOn" />
                  <div class="messaging-wrap">
                    <div>
                      Add available bindings by typing <strong>
                        &#125;&#125;
                      </strong>
                    </div>
                  </div>
                {/if}
              </div>
            </CodeEditorModal>
          {:else if value.customType === "loopOption"}
            <Select
              on:change={e => onChange(e, key)}
              autoWidth
              value={inputData[key]}
              options={["Array", "String"]}
              defaultValue={"Array"}
            />
          {:else if value.type === "string" || value.type === "number" || value.type === "integer"}
            {#if isTestModal}
              <ModalBindableInput
                title={value.title}
                value={inputData[key]}
                panel={AutomationBindingPanel}
                type={value.customType}
                on:change={e => onChange(e, key)}
                {bindings}
                updateOnChange={false}
              />
            {:else}
              <div class="test">
                <DrawerBindableInput
                  fillWidth={true}
                  title={value.title}
                  panel={AutomationBindingPanel}
                  type={value.customType}
                  value={inputData[key]}
                  on:change={e => onChange(e, key)}
                  {bindings}
                  updateOnChange={false}
                  placeholder={value.customType === "queryLimit"
                    ? queryLimit
                    : ""}
                  drawerLeft="260px"
                />
              </div>
            {/if}
          {/if}
        </div>
      </div>
    {/if}
  {/each}
</div>
<Modal bind:this={webhookModal} width="30%">
  <CreateWebhookModal />
</Modal>

{#if stepId === TriggerStepID.WEBHOOK}
  <Button secondary on:click={() => webhookModal.show()}>Set Up Webhook</Button>
{/if}

<style>
  .field-width {
    width: 320px;
  }

  .messaging {
    display: flex;
    align-items: center;
    margin-top: var(--spacing-xl);
  }
  .fields {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    gap: var(--spacing-s);
  }

  .block-field {
    display: flex; /* Use Flexbox */
    justify-content: space-between;
    align-items: center;
    flex-direction: row; /* Arrange label and field side by side */
    align-items: center; /* Align vertically in the center */
    gap: 10px; /* Add some space between label and field */
    flex: 1;
  }

  .test :global(.drawer) {
    width: 10000px !important;
  }
</style>
