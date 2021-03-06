import Feature from "Feature";
import { ready as elementReady } from "Lib/mutation";
import { Identifier, getCollection } from "Lib/scryfall";
import { sortByAttribute } from "Lib/sort";
import createElement from "Lib/create-element";
import Modal from "Ui/modal";
import { FEATURE_IDS as ids, FEATURE_SECTIONS as sections } from "Constants";
import type { Card } from "scryfall-client/dist/types/model";

import "./index.css";

const MAX_ENTRIES_TO_AUTO_LOOKUP = 75 * 2; // 2 collection API calls

class TokenList extends Feature {
  elements: HTMLAnchorElement[];
  modal?: Modal;
  private _addedToUI?: boolean;
  private _generateTokenCollectionPromise?: Promise<Card[]>;

  static metadata = {
    id: ids.TokenList,
    title: "Token List",
    section: sections.DECK_VIEW,
    description: "List tokens created by cards in the deck.",
    futureFeature: false,
  };

  static settingsDefaults = {
    enabled: true,
  };

  static usesSidebar = true;

  constructor() {
    super();

    this.elements = [];
  }

  async run(): Promise<void> {
    // TODO this doesn't work with current implementation of mutation.ready
    // in that subsequent calls to ready will not work
    elementReady<HTMLDivElement>(
      "#shambleshark-deck-display-sidebar-toolbox",
      async (container) => {
        this.createUI(container);
        this.getCardElements();

        if ((this.elements.length || 0) <= MAX_ENTRIES_TO_AUTO_LOOKUP) {
          await this.generateTokenCollection();
        }
      }
    );
  }

  createUI(container: HTMLDivElement): void {
    const section = createElement(`<div>
      <button name="button" type="button" class="button-n">
        <b>Show Tokens</b>
      </button>
    </div>`);
    const button = section.querySelector("button") as HTMLButtonElement;
    this.modal = new Modal({
      id: "token-list-modal",
      header: "Tokens",
      loadingMessage: "Loading tokens from deck",
      onOpen: async (modalInstance: Modal): Promise<void> => {
        // TODO add loading message if it takes too long
        const tokens = await this.generateTokenCollection();

        this.addToUI(tokens);

        modalInstance.setLoading(false);
      },
      onClose(): void {
        button.focus();
      },
    });
    document.body.appendChild(this.modal.element);

    button.addEventListener("click", () => {
      this.modal?.open();
    });

    container.appendChild(section);
  }

  addToUI(tokens: Card[]): void {
    if (this._addedToUI) {
      return;
    }

    this._addedToUI = true;

    if (tokens.length === 0) {
      this.modal?.setContent(
        createElement<HTMLParagraphElement>("<p>No tokens detected.</p>")
      );

      return;
    }

    const container = document.createElement("div");
    container.classList.add("token-list-img-container");

    tokens.forEach((token) => {
      const el = createElement<HTMLAnchorElement>(`
        <a href="${token.scryfall_uri}">
          <img
            class="token-list-img"
            src="${token.getImage()}"
            alt="${token.name}"
          >
        </a>
      `);

      container.appendChild(el);
    });

    this.modal?.setContent(container);
  }

  getCardElements(): void {
    this.elements.push(
      ...Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          ".deck-list-entry .deck-list-entry-name a"
        )
      )
    );
    if (this.elements.length === 0) {
      this.elements.push(
        ...Array.from(
          document.querySelectorAll<HTMLAnchorElement>("a.card-grid-item-card")
        )
      );
    }
  }

  async generateTokenCollection(): Promise<Card[]> {
    // TODO add meta data about what cards create the tokens
    if (this._generateTokenCollectionPromise) {
      return this._generateTokenCollectionPromise;
    }

    if (this.elements.length === 0) {
      return Promise.resolve([]);
    }

    const entries = (this.elements || []).map((el) =>
      this.parseSetAndCollectorNumber(el.href)
    );

    this._generateTokenCollectionPromise = this.lookupTokens(entries).then(
      (tokenCollection: Card[][]) =>
        this.flattenTokenCollection(tokenCollection) || []
    );

    return this._generateTokenCollectionPromise;
  }

  parseSetAndCollectorNumber(url: string): Identifier {
    const parts = url.split("https://scryfall.com/card/")[1].split("/");
    const [set, collector_number] = parts;

    return {
      set,
      collector_number,
    };
  }

  async lookupTokens(entries: Identifier[]): Promise<Card[][]> {
    const cards = await getCollection(entries);
    const tokens = cards.map((c) => c.getTokens());

    return Promise.all(tokens);
  }

  flattenTokenCollection(tokenCollection: Card[][]): Card[] {
    // Tokens can have the same name, but be functionally different
    // IE: https://scryfall.com/search?q=t%3Atoken+!"Vampire"&unique=cards
    // TODO this doesn't handle double sided tokens particularly well
    // might be something to handle in the underlying scryfall-client module
    return [
      ...new Map(
        tokenCollection.flat().map((token) => [token.oracle_id, token])
      ).values(),
    ].sort(sortByAttribute(["name"]));
  }
}

export default TokenList;
