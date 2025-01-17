/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import type {
  SelectOption,
} from "@itwin/itwinui-react";
import {
  Fieldset,
  LabeledInput,
  LabeledSelect,
  MenuItem,
  Small,
} from "@itwin/itwinui-react";
import React, { useEffect, useState } from "react";
import ActionPanel from "./ActionPanel";
import {
  BboxDimension,
  BboxDimensionsDecorator,
} from "../../decorators/BboxDimensionsDecorator";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, WidgetHeader } from "./utils";
import { visualizeElements, zoomToElements } from "./viewerUtils";
import "./CalculatedPropertyAction.scss";
import type { ICalculatedPropertyTyped } from "./CalculatedPropertyTable";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { CalculatedPropertyType } from "@itwin/insights-client";

interface CalculatedPropertyActionProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  property?: ICalculatedPropertyTyped;
  ids: string[];
  returnFn: (modified: boolean) => Promise<void>;
}

const CalculatedPropertyAction = ({
  iModelId,
  mappingId,
  groupId,
  property,
  ids,
  returnFn,
}: CalculatedPropertyActionProps) => {
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [propertyName, setPropertyName] = useState<string>(
    property?.propertyName ?? "",
  );
  const [type, setType] = useState<CalculatedPropertyType>(property?.type ?? CalculatedPropertyType.Undefined);
  const [bboxDecorator, setBboxDecorator] = useState<BboxDimensionsDecorator | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [inferredSpatialData, setInferredSpatialData] = useState<Map<BboxDimension, number> | undefined>();
  const [validator, showValidationMessage] = useValidator();

  useEffect(() => {
    const decorator = new BboxDimensionsDecorator();
    IModelApp.viewManager.addDecorator(decorator);
    setBboxDecorator(decorator);
    return () => {
      IModelApp.viewManager.dropDecorator(decorator);
    };
  }, []);

  useEffect(() => {
    if (ids.length === 0) {
      return;
    }
    visualizeElements([ids[0]], "red");
    void zoomToElements([ids[0]]);
  }, [ids]);

  useEffect(() => {
    if (ids.length === 0) {
      return;
    }
    const setContext = async () => {
      if (bboxDecorator) {
        await bboxDecorator.setContext(ids[0]);
        setInferredSpatialData(bboxDecorator.getInferredSpatialData());
      }
    };
    void setContext();
  }, [bboxDecorator, ids]);

  useEffect(() => {
    if (bboxDecorator && type && inferredSpatialData) {
      inferredSpatialData.has(BboxDimension[type as keyof typeof BboxDimension])
        ? bboxDecorator.drawContext(
          BboxDimension[type as keyof typeof BboxDimension],
        )
        : bboxDecorator.clearContext();
    }
  }, [bboxDecorator, inferredSpatialData, type]);

  const onSave = async () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    try {
      setIsLoading(true);

      const accessToken = await getAccessToken();

      property
        ? await mappingClient.updateCalculatedProperty(
          accessToken,
          iModelId,
          mappingId,
          groupId,
          property.id,
          {
            propertyName,
            type,
          },
        )
        : await mappingClient.createCalculatedProperty(
          accessToken,
          iModelId,
          mappingId,
          groupId,
          {
            propertyName,
            type,
          },
        );
      await returnFn(true);
    } catch (error: any) {
      handleError(error.status);
      setIsLoading(false);
    }
  };

  const getSpatialData = (value: string) =>
    inferredSpatialData?.has(
      BboxDimension[value as keyof typeof BboxDimension],
    ) && (
      <div>
        {`${inferredSpatialData
          ?.get(BboxDimension[value as keyof typeof BboxDimension])
          ?.toPrecision(4)}m`}
      </div>
    );

  return (
    <>
      <WidgetHeader
        title={
          property
            ? `${property?.propertyName ?? ""}`
            : "Create Calculated Property"
        }
        returnFn={async () => returnFn(false)}
      />
      <div className='gmw-calculated-properties-action-container'>
        <Fieldset legend='Calculated Property Details' className='gmw-details-form'>
          <Small className='gmw-field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>
          <LabeledInput
            value={propertyName}
            required
            name='name'
            label='Name'
            onChange={(event) => {
              setPropertyName(event.target.value);
              validator.showMessageFor("name");
            }}
            message={validator.message("name", propertyName, NAME_REQUIREMENTS)}
            status={
              validator.message("name", propertyName, NAME_REQUIREMENTS)
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("name");
            }}
            onBlurCapture={(event) => {
              setPropertyName(event.target.value);
              validator.showMessageFor("name");
            }}
          />
          <LabeledSelect<CalculatedPropertyType>
            label='Quantity Type'
            required
            options={[
              { value: CalculatedPropertyType.Length, label: "Length" },
              { value: CalculatedPropertyType.Area, label: "Area" },
              { value: CalculatedPropertyType.Volume, label: "Volume" },
              {
                value: CalculatedPropertyType.BoundingBoxLongestEdgeLength,
                label: "Longest Edge Length",
              },
              {
                value: CalculatedPropertyType.BoundingBoxIntermediateEdgeLength,
                label: "Intermediate Edge Length",
              },
              {
                value: CalculatedPropertyType.BoundingBoxShortestEdgeLength,
                label: "Shortest Edge Length",
              },
              {
                value: CalculatedPropertyType.BoundingBoxDiagonalLength,
                label: "Diagonal Length",
              },
              {
                value: CalculatedPropertyType.BoundingBoxLongestFaceDiagonalLength,
                label: "Longest Face Diagonal Length",
              },
              {
                value: CalculatedPropertyType.BoundingBoxIntermediateFaceDiagonalLength,
                label: "Intermediate Face Diagonal Length",
              },
              {
                value: CalculatedPropertyType.BoundingBoxShortestFaceDiagonalLength,
                label: "Shortest Face Diagonal Length",
              },
            ]}
            value={type}
            onChange={setType}
            itemRenderer={(option: SelectOption<string>) => (
              <MenuItem>
                <div className='gmw-gr-cp-menu-item'>
                  <div>{option.label}</div>
                  {getSpatialData(option.value)}
                </div>
              </MenuItem>
            )}
            selectedItemRenderer={(option: SelectOption<string>) => (
              <div className='gmw-select-item'>
                <div>{option.label}</div>
                {getSpatialData(option.value)}
              </div>
            )}
            onShow={() => { }}
            onHide={() => { }}
          />
        </Fieldset>
      </div>
      <ActionPanel
        onSave={onSave}
        onCancel={async () => returnFn(false)}
        isSavingDisabled={!(type && propertyName)}
        isLoading={isLoading}
      />
    </>
  );
};

export default CalculatedPropertyAction;
