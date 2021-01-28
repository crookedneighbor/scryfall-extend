import CardNicknameDisplay from "Features/card-page-features/card-nickname-display";
import { ready } from "Lib/mutation";

import SpyInstance = jest.SpyInstance;
import { mocked } from "ts-jest/utils";

jest.mock("Lib/mutation");

describe("CardNicknameDisplay", () => {
  describe("run", () => {
    const { location } = window;
    let container: HTMLDivElement;
    let settingsSpy: SpyInstance;

    beforeEach(() => {
      container = document.createElement("div");
      settingsSpy = jest
        .spyOn(CardNicknameDisplay, "getSettings")
        .mockResolvedValue({
          location: "sidebar",
        });
      mocked(ready).mockImplementation((selector, cb) => {
        cb(container);
      });

      // @ts-ignore
      delete window.location;
      // @ts-ignore
      window.location = {
        pathname: "/card/foo/123/card-name",
      };
    });

    afterEach(() => {
      window.location = location;
    });

    it("adds container to the prints element when set code and collector number match a nickname", async () => {
      window.location.pathname = "/card/grn/161/conclave-centaur";
      const tm = new CardNicknameDisplay();

      await tm.run();

      const el = container.querySelector(
        ".prints-info-section-note"
      ) as HTMLDivElement;
      expect(el).toBeTruthy();
      expect(el.innerText).toBe('Scryfall Preview Name: "Elfcoil Engine"');
    });

    it("does not add container to the prints element when no nicknames match", async () => {
      window.location.pathname = "/card/foo/bar/not-a-match";
      const tm = new CardNicknameDisplay();

      await tm.run();

      expect(container.querySelector(".prints-info-section-note")).toBeFalsy();
    });

    it("adds to card title instead when 'flavor-name' setting is used", async () => {
      window.location.pathname = "/card/grn/161/conclave-centaur";
      settingsSpy.mockResolvedValue({
        location: "flavor-name",
      });
      const tm = new CardNicknameDisplay();

      await tm.run();

      const el = container.querySelector("em") as HTMLDivElement;
      expect(el).toBeTruthy();
      expect(el.innerText).toBe('"Elfcoil Engine" (Scryfall Preview Name)');
    });
  });
});
