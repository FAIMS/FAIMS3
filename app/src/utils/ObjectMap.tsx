/**
 * A utility class that provides a map-like interface for plain JavaScript objects.
 * This class offers static methods to perform common map operations on objects.
 *
 * @template K - The type of keys in the object (must be a valid object key type)
 * @template V - The type of values in the object
 */
class ObjectMap {
  /**
   * Retrieves the value associated with the specified key in the object.
   *
   * @param obj - The object to operate on
   * @param key - The key to look up
   * @returns The value associated with the key, or undefined if the key doesn't exist
   */
  static get<K extends PropertyKey, V = any>(
    obj: Record<K, V>,
    key: K
  ): V | undefined {
    return obj[key];
  }

  /**
   * Sets the value for the specified key in the object.
   *
   * @param obj - The object to operate on
   * @param key - The key to set
   * @param value - The value to associate with the key
   * @returns The updated object
   */
  static set<K extends PropertyKey, V = any>(
    obj: Record<K, V>,
    key: K,
    value: V
  ): Record<K, V> {
    obj[key] = value;
    return obj;
  }

  /**
   * Checks if the object contains the specified key.
   *
   * @param obj - The object to check
   * @param key - The key to look for
   * @returns True if the key exists in the object, false otherwise
   */
  static has<K extends PropertyKey, V = any>(
    obj: Record<K, V>,
    key: K
  ): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  /**
   * Removes the specified key and its associated value from the object.
   *
   * @param obj - The object to operate on
   * @param key - The key to remove
   * @returns True if the key was found and removed, false otherwise
   */
  static delete<K extends PropertyKey, V = any>(
    obj: Record<K, V>,
    key: K
  ): boolean {
    if (ObjectMap.has(obj, key)) {
      delete obj[key];
      return true;
    }
    return false;
  }

  /**
   * Returns the number of key/value pairs in the object.
   *
   * @param obj - The object to count
   * @returns The number of key/value pairs in the object
   */
  static size<K extends PropertyKey, V = any>(obj: Record<K, V>): number {
    return Object.keys(obj).length;
  }

  /**
   * Removes all key/value pairs from the object.
   *
   * @param obj - The object to clear
   * @returns The empty object
   */
  static clear<K extends PropertyKey, V = any>(
    obj: Record<K, V>
  ): Record<K, V> {
    for (const key in obj) {
      if (ObjectMap.has(obj, key)) {
        delete obj[key];
      }
    }
    return obj;
  }

  /**
   * Returns an array of all keys in the object.
   *
   * @param obj - The object to get keys from
   * @returns An array of all keys in the object
   */
  static keys<K extends PropertyKey, V = any>(obj: Record<K, V>): K[] {
    return Object.keys(obj) as K[];
  }

  /**
   * Returns an array of all values in the object.
   *
   * @param obj - The object to get values from
   * @returns An array of all values in the object
   */
  static values<K extends PropertyKey, V = any>(obj: Record<K, V>): V[] {
    return Object.values(obj);
  }

  /**
   * Returns an array of key/value pairs for every entry in the object.
   *
   * @param obj - The object to get entries from
   * @returns An array of key/value pairs
   */
  static entries<K extends PropertyKey, V = any>(obj: Record<K, V>): [K, V][] {
    return Object.entries(obj) as [K, V][];
  }
}

export default ObjectMap;
