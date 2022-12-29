/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { screen } from "@testing-library/react";
import * as moq from "typemoq";
import type { EC3Job, IEC3JobsClient } from "@itwin/insights-client";
import { CarbonUploadState } from "@itwin/insights-client";
import faker from "@faker-js/faker";
import { renderWithContext } from "./test-utils";
import { ExportModal } from "../components/ExportModal";

jest.mock("@itwin/itwinui-react", () => ({
  ...jest.requireActual("@itwin/itwinui-react"),
  toaster: {
    positive: (_: string) => { },
    negative: (_: string) => { },
  },
}));

const jobsClient = moq.Mock.ofType<IEC3JobsClient>();

describe("Export Modal", () => {
  const templateId = "1111-2222-3333-4444";
  const jobId = "4444-3333-2222-1111";

  const job: EC3Job = {
    id: jobId,
    _links: {
      status: {
        href: "status",
      },
    },
  };

  function status(state: CarbonUploadState) {
    return {
      status: state,
      _links: {
        ec3Project: {
          href: jobId,
        },
      },
    };
  }

  const accessToken = faker.datatype.uuid();
  const ec3Token = faker.datatype.uuid();
  const getAccessTokenFn = async () => accessToken;

  beforeAll(async () => {
    jobsClient.setup(async (x) => x.createJob(accessToken, moq.It.isAny())).returns(async () => job);
  });

  it("Export modal with the isOpen prop should render successfully and be visible", async () => {
    renderWithContext({
      component: <ExportModal
        projectName=""
        isOpen={true}
        close={() => { }}
        templateId={templateId}
        token={undefined}
      />,
    });
    expect(screen.getByTestId("ec3-export-modal")).toBeDefined();
    expect(document.querySelectorAll(".iui-dialog-visible")).toBeDefined();
  });

  it("Export modal without the isOpen prop should be invisible", async () => {
    renderWithContext({
      component: <ExportModal
        projectName=""
        isOpen={false}
        close={() => { }}
        templateId={templateId}
        token={undefined}
      />,
    });
    expect(document.querySelector(".ec3-export-modal")).toBeDefined();
    expect(document.querySelector(".iui-dialog-visible")).toBeNull();
  });

  it("Interval should be set when modal is open and ec3 token is received", async () => {
    let event: Function | undefined;
    jest.spyOn(window, "setInterval").mockImplementation((callback, _) => {
      event = callback;
      return setTimeout(() => { });
    });

    expect(event).toBe(undefined);
    renderWithContext({
      component: <ExportModal
        projectName=""
        isOpen={true}
        close={() => { }}
        templateId={templateId}
        token={ec3Token}
      />,
      ec3JobsClient: jobsClient.object,
      getAccessTokenFn,
    });
    expect(screen.getByTestId("ec3-export-modal")).toBeDefined();
    expect(document.querySelector(".iui-dialog-visible")).toBeDefined();
    await new Promise((f) => setTimeout(f, 1));
    expect(event).not.toBe(undefined);
  });

  it("Correct info should be displayed for each status", async () => {
    let event: Function | undefined;
    jest.spyOn(window, "setInterval").mockImplementation((callback, _) => {
      event = callback;
      return setTimeout(() => { });
    });

    expect(event).toBe(undefined);
    renderWithContext({
      component: <ExportModal
        projectName=""
        isOpen={true}
        close={() => { }}
        templateId={templateId}
        token={ec3Token}
      />,
      ec3JobsClient: jobsClient.object,
      getAccessTokenFn,
    });
    const modal = screen.getByTestId("ec3-export-modal");
    expect(modal).toBeDefined();
    expect(document.querySelector(".iui-dialog-visible")).toBeDefined();
    await new Promise((f) => setTimeout(f, 1));
    expect(event).not.toBe(undefined);

    jobsClient.setup(async (x) => x.getEC3JobStatus(accessToken, jobId)).returns(async () => status(CarbonUploadState.Queued));
    await event!();
    expect(modal.querySelector(".iui-text-leading")).toHaveTextContent("Export queued");

    jobsClient.setup(async (x) => x.getEC3JobStatus(accessToken, jobId)).returns(async () => status(CarbonUploadState.Running));
    await event!();
    expect(modal.querySelector(".iui-text-leading")).toHaveTextContent("Export running");

    jobsClient.setup(async (x) => x.getEC3JobStatus(accessToken, jobId)).returns(async () => status(CarbonUploadState.Succeeded));
    await event!();
    expect(modal.querySelector(".iui-button-label")).toHaveTextContent("Open in EC3");

    jobsClient.setup(async (x) => x.getEC3JobStatus(accessToken, jobId)).returns(async () => status(CarbonUploadState.Failed));
    await event!();
    expect(modal.querySelector(".iui-text-leading")).toHaveTextContent("Export failed");
  });
});
