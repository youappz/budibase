<script>
  import { automationStore, selectedAutomation } from "builderStore"
  import { Icon, Body, StatusLight, AbsTooltip } from "@budibase/bbui"
  import { externalActions } from "./ExternalActions"
  import { createEventDispatcher } from "svelte"
  import { Features } from "constants/backend/automations"

  export let block
  export let open
  export let showTestStatus = false
  export let testResult
  export let isTrigger
  export let idx
  export let addLooping
  export let deleteStep
  export let enableNaming = true
  let validRegex = /^[A-Za-z0-9_\s]+$/
  let typing = false

  const dispatch = createEventDispatcher()

  $: stepNames = $selectedAutomation?.definition.stepNames
  $: automationName = stepNames?.[block.id] || block?.name || ""
  $: automationNameError = getAutomationNameError(automationName)
  $: status = updateStatus(testResult, isTrigger)
  $: isHeaderTrigger = isTrigger || block.type === "TRIGGER"

  $: {
    if (!testResult) {
      testResult = $automationStore.testResults?.steps?.filter(step =>
        block.id ? step.id === block.id : step.stepId === block.stepId
      )?.[0]
    }
  }
  $: loopBlock = $selectedAutomation?.definition.steps.find(
    x => x.blockToLoop === block?.id
  )

  async function onSelect(block) {
    await automationStore.update(state => {
      state.selectedBlock = block
      return state
    })
  }

  function updateStatus(results, isTrigger) {
    if (!results) {
      return {}
    }
    const lcStatus = results.outputs?.status?.toLowerCase()
    if (lcStatus === "stopped" || lcStatus === "stopped_error") {
      return { yellow: true, message: "Stopped" }
    } else if (results.outputs?.success || isTrigger) {
      return { positive: true, message: "Success" }
    } else {
      return { negative: true, message: "Error" }
    }
  }

  const getAutomationNameError = name => {
    if (stepNames) {
      for (const [key, value] of Object.entries(stepNames)) {
        if (name === value && key !== block.id) {
          return "This name already exists, please enter a unique name"
        }
      }
    }

    if (name !== block.name && name?.length > 0) {
      let invalidRoleName = !validRegex.test(name)
      if (invalidRoleName) {
        return "Please enter a role name consisting of only alphanumeric symbols and underscores"
      }

      return null
    }
  }

  const startTyping = async () => {
    typing = true
  }

  const saveName = async () => {
    if (automationNameError || block.name === automationName) {
      return
    }

    if (automationName.length === 0) {
      await automationStore.actions.deleteAutomationName(block.id)
    } else {
      await automationStore.actions.saveAutomationName(block.id, automationName)
    }
  }
</script>

<div
  class:typing={typing && !automationNameError}
  class:typing-error={automationNameError}
  class="blockSection"
  on:click={() => dispatch("toggle")}
>
  <div class="splitHeader">
    <div class="center-items">
      {#if externalActions[block.stepId]}
        <img
          alt={externalActions[block.stepId].name}
          width="28px"
          height="28px"
          src={externalActions[block.stepId].icon}
        />
      {:else}
        <svg
          width="28px"
          height="28px"
          class="spectrum-Icon"
          style="color:var(--spectrum-global-color-gray-700);"
          focusable="false"
        >
          <use xlink:href="#spectrum-icon-18-{block.icon}" />
        </svg>
      {/if}
      <div class="iconAlign">
        {#if isHeaderTrigger}
          <Body size="XS"><b>Trigger</b></Body>
        {:else}
          <div style="margin-left: 2px;">
            <Body size="XS"><b>Step {idx}</b></Body>
          </div>
        {/if}

        {#if enableNaming}
          <input
            class="input-text"
            disabled={!enableNaming}
            placeholder="Enter some text"
            name="name"
            autocomplete="off"
            value={automationName}
            on:input={e => {
              automationName = e.target.value.trim()
            }}
            on:click={e => {
              e.stopPropagation()
              startTyping()
            }}
            on:keydown={async e => {
              if (e.key === "Enter") {
                typing = false
                if (automationNameError) {
                  automationName = stepNames[block.id] || block?.name
                } else {
                  await saveName()
                }
              }
            }}
            on:blur={async () => {
              typing = false
              if (automationNameError) {
                automationName = stepNames[block.id] || block?.name
              } else {
                await saveName()
              }
            }}
          />
        {:else}
          <div class="input-text">
            {automationName}
          </div>
        {/if}
      </div>
    </div>
    <div class="blockTitle">
      {#if showTestStatus && testResult}
        <div class="status-container">
          <div style="float:right;">
            <StatusLight
              positive={status?.positive}
              yellow={status?.yellow}
              negative={status?.negative}
            >
              <Body size="XS">{status?.message}</Body>
            </StatusLight>
          </div>
          <Icon
            e.stopPropagation()
            on:click={e => {
              e.stopPropagation()
              dispatch("toggle")
            }}
            hoverable
            name={open ? "ChevronUp" : "ChevronDown"}
          />
        </div>
      {/if}
      <div
        class="context-actions"
        class:hide-context-actions={typing}
        on:click={() => {
          onSelect(block)
        }}
      >
        {#if !showTestStatus}
          {#if !isHeaderTrigger && !loopBlock && (block?.features?.[Features.LOOPING] || !block.features)}
            <AbsTooltip type="info" text="Add looping">
              <Icon on:click={addLooping} hoverable name="RotateCW" />
            </AbsTooltip>
          {/if}
          {#if !isHeaderTrigger}
            <AbsTooltip type="negative" text="Delete step">
              <Icon on:click={deleteStep} hoverable name="DeleteOutline" />
            </AbsTooltip>
          {/if}
        {/if}
        {#if !showTestStatus}
          <Icon
            on:click={e => {
              e.stopPropagation()
              dispatch("toggle")
            }}
            hoverable
            name={open ? "ChevronUp" : "ChevronDown"}
          />
        {/if}
      </div>
      {#if automationNameError}
        <div class="error-container">
          <AbsTooltip type="negative" text={automationNameError}>
            <div class="error-icon">
              <Icon size="S" name="Alert" />
            </div>
          </AbsTooltip>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .status-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-m);
    /* You can also add padding or margin to adjust the spacing between the text and the chevron if needed. */
  }

  .context-actions {
    display: flex;
    gap: var(--spacing-l);
    margin-bottom: var(--spacing-xs);
  }
  .center-items {
    display: flex;
    align-items: center;
  }
  .splitHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .iconAlign {
    padding: 0 0 0 var(--spacing-m);
    display: inline-block;
  }

  .blockSection {
    padding: var(--spacing-xl);
    border: 1px solid transparent;
  }

  .blockTitle {
    display: flex;
  }

  .hide-context-actions {
    display: none;
  }
  input {
    color: var(--ink);
    background-color: transparent;
    border: 1px solid transparent;
    width: 230px;
    box-sizing: border-box;
    overflow: hidden;
    white-space: nowrap;
  }

  .input-text {
    font-size: var(--spectrum-alias-font-size-default);
    font-family: var(--font-sans);
    text-overflow: ellipsis;
  }

  input:focus {
    outline: none;
  }

  /* Hide arrows for number fields */
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .typing {
    border: 1px solid var(--spectrum-global-color-static-blue-500);
    border-radius: 4px 4px 4px 4px;
  }

  .typing-error {
    border: 1px solid var(--spectrum-global-color-static-red-500);
    border-radius: 4px 4px 4px 4px;
  }

  .error-icon :global(.spectrum-Icon) {
    fill: var(--spectrum-global-color-red-400);
  }

  .error-container {
    padding-top: var(--spacing-xl);
  }
</style>
