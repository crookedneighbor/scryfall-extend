import bus from "framebus";
import scryfall from "Js/scryfall-embed/scryfall-globals";
import modifyCleanUp from "Js/scryfall-embed/modify-clean-up";
import {
  sortByName,
  sortByPrimaryCardType,
} from "Js/scryfall-embed/modify-clean-up/sorting";

import { Deck } from "Js/types/deck";
import { generateScryfallGlobal } from "../../mocks/scryfall-global";

import { makeFakeDeck, makeFakeCard } from "Helpers/fake";

jest.mock("framebus");
jest.mock("Js/scryfall-embed/modify-clean-up/sorting");

describe("modifyCleanUp", function () {
  beforeEach(() => {
    window.Scryfall = generateScryfallGlobal();
  });

  describe("cleanup gobal", () => {
    let fakeDeck: Deck;
    let originalCleanupFunction: (...args: unknown[]) => void;

    beforeEach(() => {
      fakeDeck = makeFakeDeck({
        primarySections: ["mainboard"],
        secondarySections: ["sideboard", "maybeboard"],
        entries: {
          mainboard: [],
          sideboard: [],
          maybeboard: [],
        },
      });
      originalCleanupFunction = window.Scryfall.deckbuilder.cleanUp;
      jest.spyOn(scryfall, "getDeck").mockResolvedValue(fakeDeck);
      jest.spyOn(scryfall, "updateEntry").mockResolvedValue(makeFakeCard());
    });

    it("replaces the cleanup function", function () {
      modifyCleanUp();

      const newCleanupFunction = window.Scryfall.deckbuilder.cleanUp;

      expect(newCleanupFunction).not.toEqual(originalCleanupFunction);
    });

    it("moves lands in nonlands section back to lands section when configured", async function () {
      modifyCleanUp({
        cleanUpLandsInSingleton: true,
      });

      const cardWithLandType = makeFakeCard({
        id: "card-with-land-type",
        section: "nonlands",
        raw_text: "raw text",
        cardDigest: {
          oracle_id: "oracle-id-card-with-land-type",
          type_line: "Land",
        },
      });
      const anotherCardWithLandType = makeFakeCard({
        id: "another-card-with-land-type",
        section: "nonlands",
        cardDigest: {
          oracle_id: "oracle-id-another-card-with-land-type",
          type_line: "Basic Land - Mountain",
        },
      });

      fakeDeck.sections.primary.push("nonlands");
      fakeDeck.sections.secondary.push("lands");
      fakeDeck.entries.lands = [];
      fakeDeck.entries.nonlands = [
        makeFakeCard({
          id: "card-without-a-digest",
          section: "nonlands",
          cardDigest: false,
        }),
        cardWithLandType,
        makeFakeCard({
          id: "card-with-non-land-type",
          section: "nonlands",
          cardDigest: {
            oracle_id: "oracle-id-card-with-non-land-type",
            type_line: "Creature",
          },
        }),
        anotherCardWithLandType,
      ];

      await window.Scryfall.deckbuilder.cleanUp();

      expect(scryfall.updateEntry).toBeCalledTimes(2);
      expect(scryfall.updateEntry).toBeCalledWith(cardWithLandType);
      expect(cardWithLandType.section).toBe("lands");
      expect(scryfall.updateEntry).toBeCalledWith(anotherCardWithLandType);
      expect(anotherCardWithLandType.section).toBe("lands");
    });

    it("moves nonlands in lands section back to nonlands section when configured", async function () {
      modifyCleanUp({
        cleanUpLandsInSingleton: true,
      });

      const cardWithNonLandType = makeFakeCard({
        id: "card-with-non-land-type",
        section: "lands",
        raw_text: "raw text",
        cardDigest: {
          oracle_id: "oracle-id-card-with-non-land-type",
          type_line: "Creature",
        },
      });
      const anotherCardWithNonLandType = makeFakeCard({
        id: "another-card-with-non-land-type",
        section: "lands",
        raw_text: "raw text",
        cardDigest: {
          oracle_id: "oracle-id-another-card-with-non-land-type",
          type_line: "Enchantment",
        },
      });

      fakeDeck.sections.primary.push("nonlands");
      fakeDeck.sections.secondary.push("lands");
      fakeDeck.entries.nonlands = [];
      fakeDeck.entries.lands = [
        makeFakeCard({
          id: "card-without-a-digest",
          section: "lands",
          cardDigest: false,
        }),
        cardWithNonLandType,
        makeFakeCard({
          id: "card-with-land-type",
          section: "lands",
          cardDigest: {
            type_line: "Basic Land - Mountain",
          },
        }),
        anotherCardWithNonLandType,
      ];

      await window.Scryfall.deckbuilder.cleanUp();

      expect(scryfall.updateEntry).toBeCalledTimes(2);
      expect(scryfall.updateEntry).toBeCalledWith(cardWithNonLandType);
      expect(cardWithNonLandType.section).toBe("nonlands");
      expect(scryfall.updateEntry).toBeCalledWith(anotherCardWithNonLandType);
      expect(anotherCardWithNonLandType.section).toBe("nonlands");
    });

    it("moves creaturelands in lands section back to nonlands section when configured", async function () {
      modifyCleanUp({
        cleanUpLandsInSingleton: true,
      });

      fakeDeck.sections.primary.push("nonlands");
      fakeDeck.sections.secondary.push("lands");
      fakeDeck.entries.nonlands = [];
      fakeDeck.entries.lands = [
        makeFakeCard({
          id: "card-without-a-digest",
          section: "lands",
          raw_text: "raw text",
          cardDigest: false,
        }),
        makeFakeCard({
          id: "creature-land",
          section: "lands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-creature-land",
            type_line: "Creature Land - Forest",
          },
        }),
        makeFakeCard({
          id: "card-with-land-type",
          section: "lands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-card-with-land-type",
            type_line: "Basic Land - Mountain",
          },
        }),
      ];

      await window.Scryfall.deckbuilder.cleanUp();

      expect(scryfall.updateEntry).toBeCalledTimes(1);
      expect(scryfall.updateEntry).toBeCalledWith(
        expect.objectContaining({
          id: "creature-land",
          section: "nonlands",
          raw_text: "raw text",
          card_digest: expect.objectContaining({
            oracle_id: "oracle-id-creature-land",
            type_line: "Creature Land - Forest",
          }),
        })
      );
    });

    it("does not move creaturelands in nonlands section to lands section", async function () {
      modifyCleanUp({
        cleanUpLandsInSingleton: true,
      });

      fakeDeck.sections.primary.push("nonlands");
      fakeDeck.sections.secondary.push("lands");
      fakeDeck.entries.lands = [];
      fakeDeck.entries.nonlands = [
        makeFakeCard({
          id: "card-without-a-digest",
          section: "nonlands",
          raw_text: "raw text",
          cardDigest: false,
        }),
        makeFakeCard({
          id: "creature-land",
          section: "nonlands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-creature-land",
            type_line: "Creature Land - Forest",
          },
        }),
        makeFakeCard({
          id: "card-with-nonland-type",
          section: "nonlands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-card-with-nonland-type",
            type_line: "Enchantment",
          },
        }),
      ];

      await window.Scryfall.deckbuilder.cleanUp();

      expect(scryfall.updateEntry).toBeCalledTimes(0);
    });

    it("does not move lands that transform into creatures to nonlands", async function () {
      modifyCleanUp({
        cleanUpLandsInSingleton: true,
      });

      fakeDeck.sections.primary.push("nonlands");
      fakeDeck.sections.secondary.push("lands");
      fakeDeck.entries.lands = [
        makeFakeCard({
          id: "card-without-a-digest",
          section: "lands",
          raw_text: "raw text",
          cardDigest: false,
        }),
        makeFakeCard({
          id: "land-transform",
          section: "lands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-land-transform",
            type_line: "Land // Creature",
          },
        }),
        makeFakeCard({
          id: "card-with-lands-type",
          section: "lands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-card-with-lands-type",
            type_line: "Land",
          },
        }),
      ];
      fakeDeck.entries.nonlands = [];

      await window.Scryfall.deckbuilder.cleanUp();

      expect(scryfall.updateEntry).toBeCalledTimes(0);
    });

    it("moves lands that transform into creatures to lands", async function () {
      modifyCleanUp({
        cleanUpLandsInSingleton: true,
      });

      fakeDeck.sections.primary.push("nonlands");
      fakeDeck.sections.secondary.push("lands");
      fakeDeck.entries.lands = [];
      fakeDeck.entries.nonlands = [
        makeFakeCard({
          id: "card-without-a-digest",
          section: "nonlands",
          raw_text: "raw text",
          cardDigest: false,
        }),
        makeFakeCard({
          id: "land-transform",
          section: "nonlands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-land-transform",
            type_line: "Land // Creature",
          },
        }),
        makeFakeCard({
          id: "card-with-nonlands-type",
          section: "nonlands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-card-with-nonlands-type",
            type_line: "Creature",
          },
        }),
      ];

      await window.Scryfall.deckbuilder.cleanUp();

      expect(scryfall.updateEntry).toBeCalledTimes(1);
      expect(scryfall.updateEntry).toBeCalledWith(
        expect.objectContaining({
          id: "land-transform",
          section: "lands",
          raw_text: "raw text",
          card_digest: expect.objectContaining({
            oracle_id: "oracle-id-land-transform",
            type_line: "Land // Creature",
          }),
        })
      );
    });

    it("does not move lands that transform into non-creature permaments to nonlands", async function () {
      modifyCleanUp({
        cleanUpLandsInSingleton: true,
      });

      fakeDeck.sections.primary.push("nonlands");
      fakeDeck.sections.secondary.push("lands");
      fakeDeck.entries.lands = [
        makeFakeCard({
          id: "card-without-a-digest",
          section: "lands",
          raw_text: "raw text",
          cardDigest: false,
        }),
        makeFakeCard({
          id: "land-transform",
          section: "lands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-land-transform",
            type_line: "Land // Enchantment",
          },
        }),
        makeFakeCard({
          id: "land-transform-2",
          section: "lands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-land-transform-2",
            type_line: "Land // Artifact",
          },
        }),
        makeFakeCard({
          id: "land-transform-3",
          section: "lands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-land-transform-3",
            type_line: "Land // Planeswalker",
          },
        }),
        makeFakeCard({
          id: "card-with-lands-type",
          section: "lands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-card-with-lands-type",
            type_line: "Land",
          },
        }),
      ];
      fakeDeck.entries.nonlands = [];

      await window.Scryfall.deckbuilder.cleanUp();

      expect(scryfall.updateEntry).toBeCalledTimes(0);
    });

    it("moves lands that transform into non-creature permants to lands", async function () {
      modifyCleanUp({
        cleanUpLandsInSingleton: true,
      });

      const landTransformCard = makeFakeCard({
        id: "land-transform",
        section: "nonlands",
        cardDigest: {
          oracle_id: "oracle-id-land-transform",
          type_line: "Land // Enchantment",
        },
      });
      const anotherLandTransformCard = makeFakeCard({
        id: "land-transform-2",
        section: "nonlands",
        cardDigest: {
          oracle_id: "oracle-id-land-transform-2",
          type_line: "Land // Artifact",
        },
      });
      const yetAnotherLandTransformCard = makeFakeCard({
        id: "land-transform-3",
        section: "nonlands",
        cardDigest: {
          oracle_id: "oracle-id-land-transform-3",
          type_line: "Land // Planeswalker",
        },
      });

      fakeDeck.sections.primary.push("nonlands");
      fakeDeck.sections.secondary.push("lands");
      fakeDeck.entries.lands = [];
      fakeDeck.entries.nonlands = [
        makeFakeCard({
          id: "card-without-a-digest",
          section: "nonlands",
          cardDigest: false,
        }),
        landTransformCard,
        anotherLandTransformCard,
        yetAnotherLandTransformCard,
        makeFakeCard({
          id: "card-with-nonlands-type",
          section: "nonlands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-card-with-nonlands-type",
            type_line: "Creature",
          },
        }),
      ];

      await window.Scryfall.deckbuilder.cleanUp();

      expect(scryfall.updateEntry).toBeCalledTimes(3);
      expect(scryfall.updateEntry).toBeCalledWith(landTransformCard);
      expect(landTransformCard.section).toBe("lands");
      expect(scryfall.updateEntry).toBeCalledWith(anotherLandTransformCard);
      expect(anotherLandTransformCard.section).toBe("lands");
      expect(scryfall.updateEntry).toBeCalledWith(yetAnotherLandTransformCard);
      expect(yetAnotherLandTransformCard.section).toBe("lands");
    });

    it("does not update cards if nothing is available to update", async function () {
      modifyCleanUp({
        cleanUpLandsInSingleton: true,
      });

      fakeDeck.sections.primary.push("nonlands");
      fakeDeck.sections.secondary.push("lands");
      fakeDeck.entries.nonlands = [
        makeFakeCard({
          id: "card-without-a-digest",
          section: "lands",
          cardDigest: false,
        }),
        makeFakeCard({
          id: "card-with-non-land-type",
          section: "lands",
          cardDigest: {
            oracle_id: "oracle-id-card-with-non-land-type",
            type_line: "Creature",
          },
        }),
      ];
      fakeDeck.entries.lands = [
        makeFakeCard({
          id: "card-without-a-digest",
          section: "lands",
          cardDigest: false,
        }),
        makeFakeCard({
          id: "card-with-land-type",
          section: "lands",
          raw_text: "raw text",
          cardDigest: {
            oracle_id: "oracle-id-card-with-land-type",
            type_line: "Basic Land - Mountain",
          },
        }),
      ];

      await window.Scryfall.deckbuilder.cleanUp();

      expect(scryfall.updateEntry).toBeCalledTimes(0);
    });
  });

  describe("sorting", () => {
    beforeEach(() => {
      window.Scryfall.deckbuilder.flatSections = [
        "mainboard",
        "sideboard",
        "maybeboard",
      ];
      // window.Scryfall.deckbuilder.entries = fakeDeck.entries;
    });

    it("does not setup DECK_ENTRIES_UPDATED event when config is not set to sort entries", () => {
      modifyCleanUp({});

      expect(bus.on).toBeCalledTimes(0);
    });

    it("does not setup DECK_ENTRIES_UPDATED event when config is set to none", () => {
      modifyCleanUp({
        sortEntriesPrimary: "none",
      });

      expect(bus.on).toBeCalledTimes(0);
    });

    it("sets up DECK_ENTRIES_UPDATED event when config is set to a non-none value", () => {
      modifyCleanUp({
        sortEntriesPrimary: "name",
      });

      expect(bus.on).toBeCalledTimes(1);
      expect(bus.on).toBeCalledWith(
        "DECK_ENTRIES_UPDATED",
        expect.any(Function)
      );
    });

    it("uses sortByName when configured to sort by name", () => {
      modifyCleanUp({
        sortEntriesPrimary: "name",
      });

      expect(sortByName).toBeCalledTimes(1);
    });

    it("uses sortByPrimaryCardType when configured to sort by name", () => {
      modifyCleanUp({
        sortEntriesPrimary: "card-type",
      });

      expect(sortByPrimaryCardType).toBeCalledTimes(1);
    });

    it("sorts each section of the deck when DECK_ENTRIES_UPDATED fires", () => {
      const sorterSpy = sortByName();

      // typescript doesn't like arrays of objects????
      // @ts-ignore
      jest.spyOn(window.Scryfall.deckbuilder.entries.mainboard, "sort");
      // @ts-ignore
      jest.spyOn(window.Scryfall.deckbuilder.entries.sideboard, "sort");
      // @ts-ignore
      jest.spyOn(window.Scryfall.deckbuilder.entries.maybeboard, "sort");

      // TODO better way to mock this?
      bus.on.mockImplementation((eventName: string, cb: () => void) => {
        cb();
      });

      modifyCleanUp({
        sortEntriesPrimary: "name",
      });

      expect(window.Scryfall.deckbuilder.entries.mainboard.sort).toBeCalledWith(
        sorterSpy
      );
      expect(window.Scryfall.deckbuilder.entries.sideboard.sort).toBeCalledWith(
        sorterSpy
      );
      expect(
        window.Scryfall.deckbuilder.entries.maybeboard.sort
      ).toBeCalledWith(sorterSpy);
    });
  });
});